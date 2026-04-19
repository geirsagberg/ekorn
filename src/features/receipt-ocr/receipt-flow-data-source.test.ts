import { describe, expect, it, vi } from 'vitest'
import { createCloudReceiptFlowDataSource } from './receipt-flow-cloud-data-source'
import {
  createIndexedDbReceiptFlowDataSource,
  type ReceiptFlowDataSource,
} from './receipt-flow-data-source'
import type { ReceiptRepository } from './receipt-repository'
import { buildSavedReceipt } from './saved-receipts'

describe('createIndexedDbReceiptFlowDataSource', () => {
  it('keeps the initial receipt list visible when FX backfill fails', async () => {
    const initialReceipt = buildSavedReceipt({
      analysis: createOcrResult(),
      imageFile: new File(['image'], 'saved-receipt.jpg', {
        type: 'image/jpeg',
      }),
    })
    const receiptRepository: ReceiptRepository = {
      async backfillFxConversions() {
        throw new Error('Could not refresh FX conversions.')
      },
      async deleteReceipt() {},
      async getReceipt() {
        return initialReceipt
      },
      async listReceipts() {
        return [initialReceipt]
      },
      async saveReceipt(input) {
        return buildSavedReceipt(input)
      },
      async updateReceipt() {
        return initialReceipt
      },
    }

    const dataSource = createIndexedDbReceiptFlowDataSource(receiptRepository)

    await expect(dataSource.listReceipts()).resolves.toEqual([initialReceipt])
  })

  it('captures through the repository save boundary', async () => {
    const saveReceipt = vi.fn((input) =>
      Promise.resolve(buildSavedReceipt(input)),
    )
    const receiptRepository: ReceiptRepository = {
      async backfillFxConversions(receipts) {
        return receipts
      },
      async deleteReceipt() {},
      async getReceipt() {
        return null
      },
      async listReceipts() {
        return []
      },
      saveReceipt,
      async updateReceipt() {
        throw new Error('not used')
      },
    }

    const dataSource: ReceiptFlowDataSource =
      createIndexedDbReceiptFlowDataSource(receiptRepository)

    await dataSource.captureReceipt({
      analysis: createOcrResult(),
      imageFile: new File(['image'], 'saved-receipt.jpg', {
        type: 'image/jpeg',
      }),
    })

    expect(saveReceipt).toHaveBeenCalledTimes(1)
  })

  it('captures through the cloud upload and fx enrichment boundaries', async () => {
    const createReceipt = vi.fn(async (input) => ({
      id: 'receipt-123',
      createdAt: input.createdAt,
      merchant: input.analysis.merchantName,
      total: input.analysis.total,
      subtotal: input.analysis.subtotal,
      currency: input.analysis.currency,
      status: 'ready' as const,
      fxConversion: input.fxConversion,
      imageBlob: null,
      imageName: input.imageName,
      imageType: input.imageType,
      imageUrl: 'https://cdn.example.com/receipt.jpg',
      imageStorageId: input.storageId,
      analysis: input.analysis,
    }))
    const deleteReceipt = vi.fn()
    const generateUploadUrl = vi.fn(async () => 'https://upload.example.com')
    const resolveFxConversion = vi.fn(async () => ({
      sourceCurrency: 'USD',
      targetCurrency: 'NOK',
      basisDate: '2026-04-19',
      basisKind: 'capture_date_fallback' as const,
      effectiveRateDate: '2026-04-18',
      rate: 10.5,
      provider: 'ECB' as const,
      convertedTotal: 26.25,
      convertedSubtotal: 26.25,
      conversionStatus: 'exact' as const,
    }))
    const updateReceipt = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ storageId: 'storage-123' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const dataSource = createCloudReceiptFlowDataSource({
      createReceipt,
      deleteReceipt,
      generateUploadUrl,
      resolveFxConversion,
      updateReceipt,
    })
    const imageFile = new File(['image'], 'saved-receipt.jpg', {
      type: 'image/jpeg',
    })

    const savedReceipt = await dataSource.captureReceipt({
      analysis: createOcrResult(),
      imageFile,
    })

    expect(generateUploadUrl).toHaveBeenCalledWith({})
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(resolveFxConversion).toHaveBeenCalledTimes(1)
    expect(createReceipt).toHaveBeenCalledTimes(1)
    expect(savedReceipt.id).toBe('receipt-123')

    vi.unstubAllGlobals()
  })

  it('reprocesses a cloud receipt through image reload and update boundaries', async () => {
    const createReceipt = vi.fn()
    const deleteReceipt = vi.fn()
    const generateUploadUrl = vi.fn()
    const resolveFxConversion = vi.fn(async () => ({
      sourceCurrency: 'USD',
      targetCurrency: 'NOK',
      basisDate: '2026-04-19',
      basisKind: 'capture_date_fallback' as const,
      effectiveRateDate: '2026-04-18',
      rate: 10.5,
      provider: 'ECB' as const,
      convertedTotal: 26.25,
      convertedSubtotal: 26.25,
      conversionStatus: 'exact' as const,
    }))
    const updateReceipt = vi.fn(async (input) => ({
      ...createSavedReceipt({
        id: 'receipt-123',
      }),
      createdAt: '2026-04-19T10:00:00.000Z',
      fxConversion: input.fxConversion,
      analysis: input.analysis,
      merchant: input.analysis.merchantName,
      total: input.analysis.total,
      subtotal: input.analysis.subtotal,
      currency: input.analysis.currency,
    }))
    const analyzeReceipt = vi.fn(async () =>
      createOcrResult({
        merchantName: 'Updated merchant',
      }),
    )
    const fetchMock = vi.fn(
      async () =>
        new Response(new Blob(['image'], { type: 'image/jpeg' }), {
          status: 200,
        }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const dataSource = createCloudReceiptFlowDataSource({
      createReceipt,
      deleteReceipt,
      generateUploadUrl,
      resolveFxConversion,
      updateReceipt,
    })

    const updatedReceipt = await dataSource.reprocessReceipt({
      analyzeReceipt,
      receipt: createSavedReceipt({
        imageBlob: null,
        imageUrl: 'https://cdn.example.com/receipt.jpg',
      }),
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cdn.example.com/receipt.jpg',
    )
    expect(analyzeReceipt).toHaveBeenCalledTimes(1)
    expect(resolveFxConversion).toHaveBeenCalledTimes(1)
    expect(updateReceipt).toHaveBeenCalledTimes(1)
    expect(updatedReceipt.merchant).toBe('Updated merchant')

    vi.unstubAllGlobals()
  })
})

function createOcrResult(
  overrides: Partial<Parameters<typeof buildSavedReceipt>[0]['analysis']> = {},
) {
  return {
    items: [
      {
        text: 'Milk',
        amount: 2.5,
        categories: ['Food', 'Dairy'],
        categorizationConfidence: 0.91,
        categorizationSource: 'normalized_cache' as const,
        isLowConfidence: false,
      },
    ],
    subtotal: 2.5,
    total: 2.5,
    currency: 'USD',
    purchaseDate: null,
    merchantName: null,
    sanityCheck: {
      itemSum: 2.5,
      compareTarget: 'subtotal' as const,
      expected: 2.5,
      delta: 0,
      status: 'ok' as const,
    },
    rawWarnings: [],
    ...overrides,
  }
}

function createSavedReceipt(
  overrides: Partial<ReturnType<typeof buildSavedReceipt>> = {},
) {
  return {
    ...buildSavedReceipt({
      analysis: createOcrResult(),
      imageFile: new File(['image'], 'saved-receipt.jpg', {
        type: 'image/jpeg',
      }),
    }),
    ...overrides,
  }
}
