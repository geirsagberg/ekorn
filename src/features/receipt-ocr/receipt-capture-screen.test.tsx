import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReceiptCaptureScreen } from './receipt-capture-screen'
import type { ReceiptOcrPreviewResult } from './shared'

const createObjectUrlMock = vi.fn(() => 'blob:receipt-preview')
const revokeObjectUrlMock = vi.fn()

describe('ReceiptCaptureScreen', () => {
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

  it('renders extracted line items after a successful OCR response', async () => {
    const analyzeReceipt = vi.fn().mockResolvedValue(createOcrResult())
    const { container } = render(
      <ReceiptCaptureScreen analyzeReceipt={analyzeReceipt} />,
    )

    fireEvent.change(getFileInput(container), {
      target: {
        files: [new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })],
      },
    })

    expect(await screen.findByText('Extracted lines')).toBeTruthy()
    expect(screen.getByText('Milk')).toBeTruthy()
    expect(screen.getByText('Bread')).toBeTruthy()
    expect(screen.getByText('Subtotal')).toBeTruthy()
    expect(analyzeReceipt).toHaveBeenCalledTimes(1)
  })

  it('shows a warning and still renders rows when sanity check fails', async () => {
    const analyzeReceipt = vi.fn().mockResolvedValue(
      createOcrResult({
        sanityCheck: {
          itemSum: 7,
          compareTarget: 'subtotal',
          expected: 6.5,
          delta: 0.5,
          status: 'warning',
        },
        rawWarnings: ['Line item amounts do not match the receipt summary.'],
      }),
    )
    const { container } = render(
      <ReceiptCaptureScreen analyzeReceipt={analyzeReceipt} />,
    )

    fireEvent.change(getFileInput(container), {
      target: {
        files: [new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })],
      },
    })

    expect(await screen.findByText(/Check this receipt\./)).toBeTruthy()
    expect(screen.getByText('Milk')).toBeTruthy()
  })

  it('shows a validation error for non-image files without calling OCR', async () => {
    const analyzeReceipt = vi.fn()
    const { container } = render(
      <ReceiptCaptureScreen analyzeReceipt={analyzeReceipt} />,
    )

    fireEvent.change(getFileInput(container), {
      target: {
        files: [new File(['notes'], 'receipt.txt', { type: 'text/plain' })],
      },
    })

    await waitFor(() => {
      expect(
        screen.getByText(
          'Choose an image file from your camera or photo library.',
        ),
      ).toBeTruthy()
    })
    expect(analyzeReceipt).not.toHaveBeenCalled()
  })

  it('shows a retryable error when OCR fails', async () => {
    const analyzeReceipt = vi
      .fn()
      .mockRejectedValue(new Error('Receipt OCR failed. Try another photo.'))
    const { container } = render(
      <ReceiptCaptureScreen analyzeReceipt={analyzeReceipt} />,
    )

    fireEvent.change(getFileInput(container), {
      target: {
        files: [new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })],
      },
    })

    expect(
      await screen.findByText('Receipt OCR failed. Try another photo.'),
    ).toBeTruthy()
  })
})

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
      { text: 'Milk', amount: 2.5 },
      { text: 'Bread', amount: 4.5 },
    ],
    subtotal: 7,
    total: 8.25,
    currency: 'USD',
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
