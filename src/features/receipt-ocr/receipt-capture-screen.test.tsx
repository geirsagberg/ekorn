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

  it('passes the analyzed image file to the save callback after a successful OCR response', async () => {
    const analyzeReceipt = vi.fn().mockResolvedValue(createParsedOcrResult())
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

  it('rotates and retries once when analysis returns structured rotation feedback', async () => {
    const imageBitmap = createImageBitmapStub({ width: 400, height: 300 })
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(imageBitmap))
    stubCanvas([
      new Blob(['prepared'], { type: 'image/jpeg' }),
      new Blob(['rotated'], { type: 'image/jpeg' }),
    ])
    let resolveRetry!: (
      result: ReturnType<typeof createParsedOcrResult>,
    ) => void
    const analyzeReceipt = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'rotation_required',
        rotationDegrees: 90,
        message: 'Receipt image needs rotation before parsing.',
      })
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof createParsedOcrResult>>((resolve) => {
            resolveRetry = resolve
          }),
      )
    const onCaptureSuccess = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <ReceiptCaptureScreen
        analyzeReceipt={analyzeReceipt}
        onCaptureSuccess={onCaptureSuccess}
      />,
    )

    fireEvent.change(getFileInput(container), {
      target: {
        files: [
          new File(['receipt'], 'receipt.jpeg', {
            type: 'image/jpeg',
            lastModified: 123,
          }),
        ],
      },
    })

    expect(await screen.findByText('Rotating receipt...')).toBeTruthy()
    resolveRetry(createParsedOcrResult())
    await waitFor(() => {
      expect(onCaptureSuccess).toHaveBeenCalledTimes(1)
    })
    expect(analyzeReceipt).toHaveBeenCalledTimes(2)
    const savedCapture = onCaptureSuccess.mock.calls[0]?.[0]
    expect(savedCapture.analysis).toEqual(createOcrResult())
    expect(savedCapture.imageFile.name).toBe('receipt.jpg')
    expect(savedCapture.imageFile.type).toBe('image/jpeg')
    expect(savedCapture.imageFile.lastModified).toBe(123)
    await expect(savedCapture.imageFile.text()).resolves.toBe('rotated')
  })

  it('does not force camera capture so mobile browsers can offer gallery selection', () => {
    const analyzeReceipt = vi.fn()
    const onCaptureSuccess = vi.fn()
    const { container } = render(
      <ReceiptCaptureScreen
        analyzeReceipt={analyzeReceipt}
        onCaptureSuccess={onCaptureSuccess}
      />,
    )

    expect(getFileInput(container).getAttribute('capture')).toBeNull()
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

function createParsedOcrResult(
  overrides: Partial<ReceiptOcrPreviewResult> = {},
) {
  return {
    kind: 'parsed' as const,
    analysis: createOcrResult(overrides),
  }
}

function createImageBitmapStub({
  width,
  height,
}: {
  width: number
  height: number
}) {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap
}

function stubCanvas(blobs: Blob[]) {
  const originalCreateElement = document.createElement.bind(document)
  const drawImage = vi.fn()
  const translate = vi.fn()
  const rotate = vi.fn()
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage, rotate, translate })),
    toBlob: vi.fn((callback: BlobCallback) => {
      callback(blobs.shift() ?? null)
    }),
  } as unknown as HTMLCanvasElement

  vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
    if (tagName === 'canvas') {
      return canvas
    }

    return originalCreateElement(tagName)
  })

  return { canvas, drawImage, rotate, translate }
}
