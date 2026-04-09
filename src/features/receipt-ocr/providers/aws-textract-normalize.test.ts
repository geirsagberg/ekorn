import { describe, expect, it } from 'vitest'
import { normalizeAwsTextractReceipt } from './aws-textract-normalize'

describe('normalizeAwsTextractReceipt', () => {
  it('maps line items, summary totals, and currency from a receipt payload', () => {
    const result = normalizeAwsTextractReceipt({
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

    expect(result).toEqual({
      items: [
        { text: 'Milk', amount: 2.5, confidence: 98.8 },
        { text: 'Bread', amount: 4.5, confidence: 98.2 },
      ],
      subtotal: 7,
      total: 8.25,
      currency: 'USD',
      rawWarnings: [],
    })
  })
})
