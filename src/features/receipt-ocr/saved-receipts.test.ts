import { describe, expect, it } from 'vitest'
import { buildSavedReceipt, deriveSavedReceiptStatus } from './saved-receipts'
import type { ReceiptOcrPreviewResult } from './shared'

describe('deriveSavedReceiptStatus', () => {
  it('returns ready when the receipt looks consistent', () => {
    expect(deriveSavedReceiptStatus(createOcrResult())).toBe('ready')
  })

  it('returns needs-review when totals do not match closely enough', () => {
    expect(
      deriveSavedReceiptStatus(
        createOcrResult({
          sanityCheck: {
            itemSum: 7,
            compareTarget: 'subtotal',
            expected: 6.5,
            delta: 0.5,
            status: 'warning',
          },
        }),
      ),
    ).toBe('needs-review')
  })

  it('returns needs-review when a line item is low confidence', () => {
    expect(
      deriveSavedReceiptStatus(
        createOcrResult({
          items: [
            {
              text: 'Milk',
              amount: 2.5,
              categories: ['Food', 'Dairy'],
              categorizationConfidence: 0.42,
              categorizationSource: 'ai_existing',
              isLowConfidence: true,
            },
          ],
        }),
      ),
    ).toBe('needs-review')
  })

  it('keeps the inferred merchant when saving a receipt', () => {
    const savedReceipt = buildSavedReceipt({
      analysis: createOcrResult({ merchantName: 'Rema 1000' }),
      imageFile: new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
    })

    expect(savedReceipt.merchant).toBe('Rema 1000')
  })
})

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
