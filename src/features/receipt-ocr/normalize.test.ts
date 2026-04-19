import { describe, expect, it } from 'vitest'
import {
  buildReceiptOcrPreviewResult,
  computeReceiptSanityCheck,
} from './normalize'

describe('buildReceiptOcrPreviewResult', () => {
  it('adds warnings for missing amounts and mismatched totals', () => {
    const result = buildReceiptOcrPreviewResult({
      items: [
        { text: 'Milk', amount: 2.5 },
        { text: 'Bread', amount: null },
      ],
      merchantName: 'Coop Mega',
      purchaseDate: '2026-04-18',
      subtotal: 7,
      total: 8.25,
      currency: 'USD',
      rawWarnings: ['Model was uncertain about one row.'],
    })

    expect(result.rawWarnings).toEqual([
      'Model was uncertain about one row.',
      'Some line items are missing amounts.',
      'Line item amounts do not match the receipt summary.',
    ])
    expect(result.sanityCheck).toEqual({
      itemSum: 2.5,
      compareTarget: 'subtotal',
      expected: 7,
      delta: -4.5,
      status: 'warning',
    })
    expect(result.merchantName).toBe('Coop Mega')
    expect(result.purchaseDate).toBe('2026-04-18')
  })
})

describe('computeReceiptSanityCheck', () => {
  it('marks a matching subtotal as ok', () => {
    expect(
      computeReceiptSanityCheck(
        [
          { text: 'Milk', amount: 2.5 },
          { text: 'Bread', amount: 4.5 },
        ],
        7,
        8.25,
      ),
    ).toEqual({
      itemSum: 7,
      compareTarget: 'subtotal',
      expected: 7,
      delta: 0,
      status: 'ok',
    })
  })

  it('warns when extracted items do not match subtotal', () => {
    expect(
      computeReceiptSanityCheck(
        [
          { text: 'Milk', amount: 2.5 },
          { text: 'Bread', amount: 4.5 },
        ],
        6.5,
        8.25,
      ),
    ).toEqual({
      itemSum: 7,
      compareTarget: 'subtotal',
      expected: 6.5,
      delta: 0.5,
      status: 'warning',
    })
  })

  it('falls back to total when subtotal is missing', () => {
    expect(
      computeReceiptSanityCheck(
        [
          { text: 'Milk', amount: 2.5 },
          { text: 'Bread', amount: 4.5 },
        ],
        null,
        7,
      ),
    ).toEqual({
      itemSum: 7,
      compareTarget: 'total',
      expected: 7,
      delta: 0,
      status: 'ok',
    })
  })

  it('returns unavailable when no summary total exists', () => {
    expect(
      computeReceiptSanityCheck(
        [
          { text: 'Milk', amount: 2.5 },
          { text: 'Bread', amount: 4.5 },
        ],
        null,
        null,
      ),
    ).toEqual({
      itemSum: 7,
      compareTarget: 'none',
      expected: null,
      delta: null,
      status: 'unavailable',
    })
  })
})
