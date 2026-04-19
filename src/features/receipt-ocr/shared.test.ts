import { describe, expect, it } from 'vitest'
import type { ReceiptOcrPreviewResult } from './shared'
import { sanitizeReceiptOcrPreviewResult } from './shared'

describe('sanitizeReceiptOcrPreviewResult', () => {
  it('removes OCR-only item confidence before persistence', () => {
    const result = sanitizeReceiptOcrPreviewResult({
      items: [
        {
          text: 'Sylte i skiver',
          amount: 80.56,
          confidence: 0.95,
          categories: ['Food', 'Meat & Seafood'],
          categorizationConfidence: 0.86,
          categorizationSource: 'ai_existing',
          isLowConfidence: false,
        },
      ],
      merchantName: 'Meny',
      purchaseDate: '2026-04-19',
      subtotal: 80.56,
      total: 80.56,
      currency: 'NOK',
      sanityCheck: {
        itemSum: 80.56,
        compareTarget: 'subtotal',
        expected: 80.56,
        delta: 0,
        status: 'ok',
      },
      rawWarnings: [],
    } as unknown as ReceiptOcrPreviewResult)

    expect(result).toEqual({
      items: [
        {
          text: 'Sylte i skiver',
          amount: 80.56,
          categories: ['Food', 'Meat & Seafood'],
          categorizationConfidence: 0.86,
          categorizationSource: 'ai_existing',
          isLowConfidence: false,
        },
      ],
      merchantName: 'Meny',
      purchaseDate: '2026-04-19',
      subtotal: 80.56,
      total: 80.56,
      currency: 'NOK',
      sanityCheck: {
        itemSum: 80.56,
        compareTarget: 'subtotal',
        expected: 80.56,
        delta: 0,
        status: 'ok',
      },
      rawWarnings: [],
    })
  })
})
