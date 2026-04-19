import { describe, expect, it, vi } from 'vitest'
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
})

function createOcrResult() {
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
  }
}
