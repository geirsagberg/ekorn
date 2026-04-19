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

  it('passes the original image file to the save callback after a successful OCR response', async () => {
    const analyzeReceipt = vi.fn().mockResolvedValue(createOcrResult())
    const onCaptureSuccess = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <ReceiptCaptureScreen
        analyzeReceipt={analyzeReceipt}
        onCaptureSuccess={onCaptureSuccess}
      />,
    )
    const receiptFile = new File(['receipt'], 'receipt.jpg', {
      type: 'image/jpeg',
    })

    fireEvent.change(getFileInput(container), {
      target: {
        files: [receiptFile],
      },
    })

    await waitFor(() => {
      expect(onCaptureSuccess).toHaveBeenCalledTimes(1)
    })
    expect(analyzeReceipt).toHaveBeenCalledTimes(1)
    expect(onCaptureSuccess).toHaveBeenCalledWith({
      analysis: createOcrResult(),
      imageFile: receiptFile,
    })
  })

  it('shows a validation error for non-image files without calling OCR', async () => {
    const analyzeReceipt = vi.fn()
    const onCaptureSuccess = vi.fn()
    const { container } = render(
      <ReceiptCaptureScreen
        analyzeReceipt={analyzeReceipt}
        onCaptureSuccess={onCaptureSuccess}
      />,
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
    expect(onCaptureSuccess).not.toHaveBeenCalled()
  })

  it('shows a retryable error when OCR fails', async () => {
    const analyzeReceipt = vi
      .fn()
      .mockRejectedValue(new Error('Receipt OCR failed. Try another photo.'))
    const onCaptureSuccess = vi.fn()
    const { container } = render(
      <ReceiptCaptureScreen
        analyzeReceipt={analyzeReceipt}
        onCaptureSuccess={onCaptureSuccess}
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
    expect(onCaptureSuccess).not.toHaveBeenCalled()
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
