import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReceiptOcrPreviewResult } from './shared'

const {
  prepareReceiptImageForAnalysisMock,
  rotateReceiptImageForAnalysisMock,
} = vi.hoisted(() => ({
  prepareReceiptImageForAnalysisMock: vi.fn(),
  rotateReceiptImageForAnalysisMock: vi.fn(),
}))

vi.mock('./receipt-image-preparation', () => ({
  prepareReceiptImageForAnalysis: prepareReceiptImageForAnalysisMock,
  rotateReceiptImageForAnalysis: rotateReceiptImageForAnalysisMock,
}))

import { analyzeReceiptImageFile } from './receipt-analysis-file'

describe('analyzeReceiptImageFile', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('keeps rotating when a corrected image is still reported as rotated', async () => {
    const originalFile = new File(['original'], 'receipt.jpg', {
      type: 'image/jpeg',
    })
    const preparedFile = new File(['prepared'], 'receipt.jpg', {
      type: 'image/jpeg',
    })
    const firstRotatedFile = new File(['rotated-once'], 'receipt.jpg', {
      type: 'image/jpeg',
    })
    const secondRotatedFile = new File(['rotated-twice'], 'receipt.jpg', {
      type: 'image/jpeg',
    })
    const onRotationRequired = vi.fn()
    const analyzeReceipt = vi
      .fn()
      .mockResolvedValueOnce(createRotationRequiredResult(90))
      .mockResolvedValueOnce(createRotationRequiredResult(90))
      .mockResolvedValueOnce(createParsedOcrResult())

    prepareReceiptImageForAnalysisMock.mockResolvedValue(preparedFile)
    rotateReceiptImageForAnalysisMock
      .mockResolvedValueOnce(firstRotatedFile)
      .mockResolvedValueOnce(secondRotatedFile)

    const result = await analyzeReceiptImageFile({
      analyzeReceipt,
      file: originalFile,
      onRotationRequired,
    })

    expect(result).toEqual({
      analysis: createOcrResult(),
      imageFile: secondRotatedFile,
    })
    expect(analyzeReceipt).toHaveBeenCalledTimes(3)
    expect(rotateReceiptImageForAnalysisMock).toHaveBeenNthCalledWith(
      1,
      preparedFile,
      90,
    )
    expect(rotateReceiptImageForAnalysisMock).toHaveBeenNthCalledWith(
      2,
      firstRotatedFile,
      180,
    )
    expect(onRotationRequired).toHaveBeenCalledTimes(2)
  })
})

function createRotationRequiredResult(rotationDegrees: 90 | 180 | 270) {
  return {
    kind: 'rotation_required' as const,
    rotationDegrees,
    message: 'Receipt image needs rotation before parsing.',
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
    ],
    subtotal: 2.5,
    total: 2.5,
    currency: 'USD',
    purchaseDate: null,
    merchantName: null,
    sanityCheck: {
      itemSum: 2.5,
      compareTarget: 'subtotal',
      expected: 2.5,
      delta: 0,
      status: 'ok',
    },
    rawWarnings: [],
    ...overrides,
  }
}
