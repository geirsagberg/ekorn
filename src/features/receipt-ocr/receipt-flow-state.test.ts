import { describe, expect, it } from 'vitest'
import {
  createReceiptFlowInitialState,
  reduceReceiptFlowState,
} from './receipt-flow-state'
import { buildSavedReceipt } from './saved-receipts'

describe('reduceReceiptFlowState', () => {
  it('opens detail and keeps receipts sorted after capture success', () => {
    const olderReceipt = createSavedReceipt({
      createdAt: '2026-04-18T09:00:00.000Z',
      id: 'receipt-1',
    })
    const newerReceipt = createSavedReceipt({
      createdAt: '2026-04-19T09:00:00.000Z',
      id: 'receipt-2',
    })

    const nextState = reduceReceiptFlowState(
      {
        ...createReceiptFlowInitialState(),
        isLoadingReceipts: false,
        receipts: [olderReceipt],
        view: { kind: 'history' },
      },
      {
        type: 'capture_succeeded',
        receipt: newerReceipt,
      },
    )

    expect(nextState.receipts.map((receipt) => receipt.id)).toEqual([
      'receipt-2',
      'receipt-1',
    ])
    expect(nextState.view).toEqual({
      kind: 'detail',
      receiptId: 'receipt-2',
    })
    expect(nextState.storageError).toBeNull()
  })

  it('returns to history when the selected detail receipt disappears', () => {
    const survivingReceipt = createSavedReceipt({
      id: 'receipt-2',
    })

    const nextState = reduceReceiptFlowState(
      {
        ...createReceiptFlowInitialState(),
        isLoadingReceipts: false,
        receipts: [survivingReceipt],
        view: { kind: 'detail', receiptId: 'missing-receipt' },
      },
      {
        type: 'sync_state_received',
        syncState: {
          isLoading: false,
          receipts: [survivingReceipt],
        },
      },
    )

    expect(nextState.view).toEqual({
      kind: 'history',
    })
  })

  it('stores the latest storage error without discarding prior receipts', () => {
    const savedReceipt = createSavedReceipt({
      id: 'receipt-1',
    })

    const nextState = reduceReceiptFlowState(
      {
        ...createReceiptFlowInitialState(),
        isLoadingReceipts: false,
        receipts: [savedReceipt],
      },
      {
        type: 'storage_failed',
        message: 'Could not update your receipt history.',
      },
    )

    expect(nextState.storageError).toBe(
      'Could not update your receipt history.',
    )
    expect(nextState.receipts).toEqual([savedReceipt])
  })
})

function createSavedReceipt(
  overrides: Partial<ReturnType<typeof buildSavedReceipt>> = {},
) {
  return {
    ...buildSavedReceipt({
      analysis: {
        items: [],
        subtotal: 1,
        total: 1,
        currency: 'USD',
        purchaseDate: null,
        merchantName: null,
        sanityCheck: {
          itemSum: 1,
          compareTarget: 'subtotal',
          expected: 1,
          delta: 0,
          status: 'ok',
        },
        rawWarnings: [],
      },
      imageFile: new File(['image'], 'saved-receipt.jpg', {
        type: 'image/jpeg',
      }),
    }),
    ...overrides,
  }
}
