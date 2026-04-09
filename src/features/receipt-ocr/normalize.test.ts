import { describe, expect, it } from 'vitest'
import {
  computeReceiptSanityCheck,
  normalizeReceiptOcrResult,
} from './normalize'

describe('normalizeReceiptOcrResult', () => {
  it('maps line items, summary totals, and currency from a receipt payload', () => {
    const result = normalizeReceiptOcrResult({
      ExpenseDocuments: [
        {
          LineItemGroups: [
            {
              LineItems: [
                {
                  LineItemExpenseFields: [
                    {
                      Type: { Text: 'ITEM' },
                      ValueDetection: { Text: 'Milk', Confidence: 98.4 },
                    },
                    {
                      Type: { Text: 'PRICE' },
                      ValueDetection: { Text: '2.50', Confidence: 99.1 },
                    },
                  ],
                },
                {
                  LineItemExpenseFields: [
                    {
                      Type: { Text: 'ITEM' },
                      ValueDetection: { Text: 'Bread', Confidence: 97.8 },
                    },
                    {
                      Type: { Text: 'PRICE' },
                      ValueDetection: { Text: '4.50', Confidence: 98.6 },
                    },
                  ],
                },
              ],
            },
          ],
          SummaryFields: [
            {
              Type: { Text: 'SUBTOTAL' },
              ValueDetection: { Text: '7.00' },
              Currency: { Code: 'USD' },
            },
            {
              Type: { Text: 'TOTAL' },
              ValueDetection: { Text: '8.25' },
              Currency: { Code: 'USD' },
            },
          ],
        },
      ],
    })

    expect(result.items).toEqual([
      { text: 'Milk', amount: 2.5, confidence: 98.8 },
      { text: 'Bread', amount: 4.5, confidence: 98.2 },
    ])
    expect(result.subtotal).toBe(7)
    expect(result.total).toBe(8.25)
    expect(result.currency).toBe('USD')
    expect(result.sanityCheck).toEqual({
      itemSum: 7,
      compareTarget: 'subtotal',
      expected: 7,
      delta: 0,
      status: 'ok',
    })
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
