import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedReceiptFxConversion } from './fx-rate/shared'
import { ReceiptFlowApp } from './receipt-flow-app'
import type { ReceiptFlowDataSource } from './receipt-flow-data-source'
import { buildSavedReceipt, type SavedReceipt } from './saved-receipts'
import type { ReceiptOcrPreviewResult } from './shared'

const createObjectUrlMock = vi.fn(() => 'blob:receipt-preview')
const revokeObjectUrlMock = vi.fn()

describe('ReceiptFlowApp', () => {
  beforeEach(() => {
    createObjectUrlMock.mockClear()
    revokeObjectUrlMock.mockClear()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('saves successful captures and opens receipt detail', async () => {
    const analyzeReceipt = vi
      .fn()
      .mockResolvedValue(createOcrResult({ merchantName: 'Coop Mega' }))
    const dataSource = createMemoryReceiptFlowDataSource()
    const { container } = render(
      <ReceiptFlowApp
        analyzeReceipt={analyzeReceipt}
        dataSource={dataSource}
      />,
    )

    fireEvent.change(getFileInput(container), {
      target: {
        files: [new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })],
      },
    })

    expect(await screen.findByText('Receipt detail')).toBeTruthy()
    expect(screen.getByText('Coop Mega')).toBeTruthy()
    expect(screen.getByText('Structured receipt')).toBeTruthy()
    expect(screen.getByText('Ready')).toBeTruthy()
    expect(dataSource.getSavedReceipts()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'History' }))

    expect(await screen.findByRole('heading', { name: 'History' })).toBeTruthy()
    expect(screen.getByText('Coop Mega')).toBeTruthy()
  })

  it('does not save failed captures', async () => {
    const analyzeReceipt = vi
      .fn()
      .mockRejectedValue(new Error('Receipt OCR failed. Try another photo.'))
    const dataSource = createMemoryReceiptFlowDataSource()
    const { container } = render(
      <ReceiptFlowApp
        analyzeReceipt={analyzeReceipt}
        dataSource={dataSource}
      />,
    )

    fireEvent.change(getFileInput(container), {
      target: {
        files: [new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })],
      },
    })

    expect(
      await screen.findByText('Receipt OCR failed. Try another photo.'),
    ).toBeTruthy()
    expect(dataSource.getSavedReceipts()).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'History' }))

    expect(await screen.findByText('No saved receipts yet')).toBeTruthy()
  })

  it('shows structured detail first and only reveals the image through an explicit action', async () => {
    const dataSource = createMemoryReceiptFlowDataSource([
      buildSavedReceipt({
        analysis: createOcrResult({
          sanityCheck: {
            itemSum: 7,
            compareTarget: 'subtotal',
            expected: 6.5,
            delta: 0.5,
            status: 'warning',
          },
        }),
        imageFile: new File(['image'], 'saved-receipt.jpg', {
          type: 'image/jpeg',
        }),
      }),
    ])

    render(<ReceiptFlowApp analyzeReceipt={vi.fn()} dataSource={dataSource} />)

    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open receipt from Unknown merchant',
      }),
    )

    expect(await screen.findByText('Receipt detail')).toBeTruthy()
    expect(screen.getByText('Structured receipt')).toBeTruthy()
    expect(screen.queryByRole('img', { name: /Receipt image for/i })).toBeNull()
    expect(screen.getByText('Needs review')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'View receipt image' }))

    expect(
      await screen.findByRole('img', {
        name: /Receipt image for saved-receipt.jpg/i,
      }),
    ).toBeTruthy()
  })

  it('shows converted home-currency totals in history and detail', async () => {
    const dataSource = createMemoryReceiptFlowDataSource([
      buildSavedReceipt({
        analysis: createOcrResult({
          currency: 'EUR',
          purchaseDate: '2026-04-18',
          total: 10,
        }),
        fxConversion: createFxConversion({
          basisDate: '2026-04-18',
          convertedTotal: 110.17,
          convertedSubtotal: 93.64,
          effectiveRateDate: '2026-04-17',
          rate: 11.017,
          sourceCurrency: 'EUR',
        }),
        imageFile: new File(['image'], 'italy-receipt.jpg', {
          type: 'image/jpeg',
        }),
      }),
    ])

    render(<ReceiptFlowApp analyzeReceipt={vi.fn()} dataSource={dataSource} />)

    fireEvent.click(await screen.findByRole('button', { name: 'History' }))

    expect(screen.getByText(/110\.17/)).toBeTruthy()
    expect(screen.getByText(/10\.00/)).toBeTruthy()

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open receipt from Unknown merchant',
      }),
    )

    expect(screen.getByText('Home total (NOK)')).toBeTruthy()
    expect(screen.getByText(/110\.17/)).toBeTruthy()
    expect(
      screen.getByText(
        'ECB rate from 2026-04-17 used for purchase date 2026-04-18.',
      ),
    ).toBeTruthy()
  })

  it('shows capture-date fallback FX notes when purchase date is missing', async () => {
    const dataSource = createMemoryReceiptFlowDataSource([
      buildSavedReceipt({
        analysis: createOcrResult({
          currency: 'EUR',
          purchaseDate: null,
          total: 10,
        }),
        createdAt: '2026-04-19T08:30:00.000Z',
        fxConversion: createFxConversion({
          basisDate: '2026-04-19',
          basisKind: 'capture_date_fallback',
          convertedTotal: 110.17,
          convertedSubtotal: 93.64,
          effectiveRateDate: '2026-04-17',
          rate: 11.017,
          sourceCurrency: 'EUR',
        }),
        imageFile: new File(['image'], 'italy-receipt.jpg', {
          type: 'image/jpeg',
        }),
      }),
    ])

    render(<ReceiptFlowApp analyzeReceipt={vi.fn()} dataSource={dataSource} />)

    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open receipt from Unknown merchant',
      }),
    )

    expect(
      screen.getByText(
        'ECB rate from 2026-04-17 used for capture date 2026-04-19 because the purchase date was missing.',
      ),
    ).toBeTruthy()
  })

  it('keeps only the original currency total when conversion is unavailable', async () => {
    const dataSource = createMemoryReceiptFlowDataSource([
      buildSavedReceipt({
        analysis: createOcrResult({
          currency: 'EUR',
          purchaseDate: '2026-04-18',
          total: 10,
        }),
        fxConversion: createFxConversion({
          conversionStatus: 'unavailable',
          convertedTotal: null,
          convertedSubtotal: null,
          effectiveRateDate: null,
          rate: null,
          sourceCurrency: 'EUR',
        }),
        imageFile: new File(['image'], 'italy-receipt.jpg', {
          type: 'image/jpeg',
        }),
      }),
    ])

    render(<ReceiptFlowApp analyzeReceipt={vi.fn()} dataSource={dataSource} />)

    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open receipt from Unknown merchant',
      }),
    )

    expect(screen.queryByText('Home total (NOK)')).toBeNull()
    expect(
      screen.getByText(
        'Historical conversion was unavailable, so this receipt is shown only in the original currency.',
      ),
    ).toBeTruthy()
  })

  it('shows confidence details behind an info icon tooltip on the category row', async () => {
    const dataSource = createMemoryReceiptFlowDataSource([
      buildSavedReceipt({
        analysis: createOcrResult(),
        imageFile: new File(['image'], 'saved-receipt.jpg', {
          type: 'image/jpeg',
        }),
      }),
    ])

    render(<ReceiptFlowApp analyzeReceipt={vi.fn()} dataSource={dataSource} />)

    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open receipt from Unknown merchant',
      }),
    )

    expect(screen.queryByText(/91% confidence/)).toBeNull()

    const confidenceButtons = screen.getAllByRole('button', {
      name: /Category confidence details:/i,
    })

    fireEvent.mouseOver(confidenceButtons[0] as Element)

    expect(await screen.findByText('91% confidence')).toBeTruthy()
    expect(
      screen.getByText('Stored categorization from a normalized label match.'),
    ).toBeTruthy()
  })

  it('deletes a saved receipt without affecting the rest of the flow', async () => {
    const dataSource = createMemoryReceiptFlowDataSource([
      buildSavedReceipt({
        analysis: createOcrResult(),
        imageFile: new File(['image'], 'saved-receipt.jpg', {
          type: 'image/jpeg',
        }),
      }),
    ])

    render(<ReceiptFlowApp analyzeReceipt={vi.fn()} dataSource={dataSource} />)

    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open receipt from Unknown merchant',
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete receipt' }),
    )

    expect(await screen.findByText('Delete receipt?')).toBeTruthy()
    expect(
      screen.getByText(
        'This removes the saved receipt from your account history, but keeps learned categorization data for future captures.',
      ),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete receipt' }))

    expect(await screen.findByRole('heading', { name: 'History' })).toBeTruthy()
    expect(screen.getByText('No saved receipts yet')).toBeTruthy()
    expect(dataSource.getSavedReceipts()).toHaveLength(0)
  })

  it('lets the user cancel receipt deletion', async () => {
    const dataSource = createMemoryReceiptFlowDataSource([
      buildSavedReceipt({
        analysis: createOcrResult(),
        imageFile: new File(['image'], 'saved-receipt.jpg', {
          type: 'image/jpeg',
        }),
      }),
    ])

    render(<ReceiptFlowApp analyzeReceipt={vi.fn()} dataSource={dataSource} />)

    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open receipt from Unknown merchant',
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete receipt' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(screen.getByText('Receipt detail')).toBeTruthy()
    expect(dataSource.getSavedReceipts()).toHaveLength(1)
  })

  it('reprocesses a saved receipt image and updates the same receipt entry', async () => {
    const initialReceipt = buildSavedReceipt({
      analysis: createOcrResult({
        merchantName: 'Old merchant',
        total: 8.25,
      }),
      imageFile: new File(['image'], 'saved-receipt.jpg', {
        type: 'image/jpeg',
      }),
    })
    const dataSource = createMemoryReceiptFlowDataSource([initialReceipt])
    const analyzeReceipt = vi.fn().mockResolvedValue(
      createOcrResult({
        items: [
          {
            text: 'Milk',
            amount: 2.5,
            categories: ['Food', 'Dairy'],
            categorizationConfidence: 0.91,
            categorizationSource: 'normalized_cache',
            isLowConfidence: false,
          },
        ],
        merchantName: 'New merchant',
        total: 9.75,
      }),
    )

    render(
      <ReceiptFlowApp
        analyzeReceipt={analyzeReceipt}
        dataSource={dataSource}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open receipt from Old merchant',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reprocess image' }))

    await waitFor(() => {
      expect(analyzeReceipt).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('New merchant')).toBeTruthy()
    expect(dataSource.getSavedReceipts()).toHaveLength(1)
    expect(dataSource.getSavedReceipts()[0]?.id).toBe(initialReceipt.id)
    expect(dataSource.getSavedReceipts()[0]?.merchant).toBe('New merchant')
    expect(dataSource.getSavedReceipts()[0]?.total).toBe(9.75)
  })

  it('resets the reprocess button label after reprocessing completes', async () => {
    const initialReceipt = buildSavedReceipt({
      analysis: createOcrResult({
        merchantName: 'Old merchant',
      }),
      imageFile: new File(['image'], 'saved-receipt.jpg', {
        type: 'image/jpeg',
      }),
    })
    const dataSource = createMemoryReceiptFlowDataSource([initialReceipt])
    let resolveAnalyzeReceipt!: (result: ReceiptOcrPreviewResult) => void
    const analyzeReceipt = vi.fn(
      () =>
        new Promise<ReceiptOcrPreviewResult>((resolve) => {
          resolveAnalyzeReceipt = resolve
        }),
    )

    render(
      <ReceiptFlowApp
        analyzeReceipt={analyzeReceipt}
        dataSource={dataSource}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open receipt from Old merchant',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reprocess image' }))

    expect(
      screen.getByRole('button', { name: 'Reprocessing receipt...' }),
    ).toBeTruthy()

    await waitFor(() => {
      expect(analyzeReceipt).toHaveBeenCalledTimes(1)
    })

    resolveAnalyzeReceipt(
      createOcrResult({
        merchantName: 'Updated merchant',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Reprocess image' }),
      ).toBeTruthy()
    })
  })
})

function createMemoryReceiptFlowDataSource(
  initialReceipts: SavedReceipt[] = [],
): ReceiptFlowDataSource & { getSavedReceipts: () => SavedReceipt[] } {
  let receipts = [...initialReceipts]

  return {
    async listReceipts() {
      return receipts
    },
    async deleteReceipt(receiptId) {
      receipts = receipts.filter((receipt) => receipt.id !== receiptId)
    },
    getSavedReceipts() {
      return receipts
    },
    async captureReceipt(input) {
      const savedReceipt = buildSavedReceipt(input)
      receipts = [savedReceipt, ...receipts]
      return savedReceipt
    },
    async reprocessReceipt({ analyzeReceipt, receipt }) {
      const currentReceipt = receipts.find(
        (currentItem) => currentItem.id === receipt.id,
      )

      if (!currentReceipt) {
        throw new Error('Could not find this receipt to update.')
      }

      const nextAnalysis = await analyzeReceipt({
        data: new FormData(),
      })

      const updatedReceipt = {
        ...currentReceipt,
        analysis: nextAnalysis,
        merchant: nextAnalysis.merchantName,
        total: nextAnalysis.total,
        subtotal: nextAnalysis.subtotal,
        currency: nextAnalysis.currency,
        fxConversion: currentReceipt.fxConversion ?? null,
        status:
          nextAnalysis.sanityCheck.status === 'warning' ||
          nextAnalysis.items.some((item) => item.isLowConfidence)
            ? 'needs-review'
            : 'ready',
      } satisfies SavedReceipt

      receipts = receipts.map((receipt) =>
        receipt.id === currentReceipt.id ? updatedReceipt : receipt,
      )

      return updatedReceipt
    },
  }
}

function getFileInput(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]')

  if (!input) {
    throw new Error('File input not found.')
  }

  return input
}

function createOcrResult(
  overrides: Partial<ReceiptOcrPreviewResult> = {},
): ReceiptOcrPreviewResult {
  return {
    items: [
      {
        text: 'Milk',
        amount: 2.5,
        categories: ['Food', 'Dairy'],
        categorizationConfidence: 0.91,
        categorizationSource: 'normalized_cache',
        isLowConfidence: false,
      },
      {
        text: 'Bread',
        amount: 4.5,
        categories: ['Food', 'Bakery'],
        categorizationConfidence: 0.88,
        categorizationSource: 'ai_existing',
        isLowConfidence: false,
      },
    ],
    subtotal: 7,
    total: 8.25,
    currency: 'USD',
    purchaseDate: null,
    merchantName: null,
    sanityCheck: {
      itemSum: 7,
      compareTarget: 'subtotal',
      expected: 7,
      delta: 0,
      status: 'ok',
    },
    rawWarnings: [],
    ...overrides,
  }
}

function createFxConversion(
  overrides: Partial<SavedReceiptFxConversion> = {},
): SavedReceiptFxConversion {
  return {
    sourceCurrency: 'EUR',
    targetCurrency: 'NOK',
    basisDate: '2026-04-18',
    basisKind: 'purchase_date',
    effectiveRateDate: '2026-04-17',
    rate: 11.017,
    convertedTotal: 110.17,
    convertedSubtotal: 77.12,
    conversionStatus: 'exact',
    ...overrides,
    provider: overrides.provider ?? 'ECB',
  }
}
