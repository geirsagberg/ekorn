import { atom, createStore, Provider, useAtomValue, useSetAtom } from 'jotai'
import { type ReactNode, useState } from 'react'
import type { ReceiptFlowSyncState } from './receipt-flow-data-source'
import type { ReceiptFlowView } from './receipt-flow-screen'
import type { SavedReceipt } from './saved-receipts'

export interface ReceiptFlowState {
  isLoadingReceipts: boolean
  receipts: SavedReceipt[]
  storageError: string | null
  view: ReceiptFlowView
}

export type ReceiptFlowAction =
  | { type: 'local_load_started' }
  | { type: 'local_load_succeeded'; receipts: SavedReceipt[] }
  | { type: 'local_load_failed'; message: string }
  | { type: 'sync_state_received'; syncState: ReceiptFlowSyncState }
  | { type: 'view_changed'; view: ReceiptFlowView }
  | { type: 'capture_succeeded'; receipt: SavedReceipt }
  | { type: 'delete_succeeded'; receiptId: string }
  | { type: 'reprocess_succeeded'; receipt: SavedReceipt }
  | { type: 'storage_failed'; message: string }

const receiptFlowStateAtom = atom<ReceiptFlowState>(
  createReceiptFlowInitialState(),
)

const selectedReceiptAtom = atom((get) => {
  const state = get(receiptFlowStateAtom)

  if (state.view.kind !== 'detail') {
    return null
  }

  const detailView = state.view

  return (
    state.receipts.find((receipt) => receipt.id === detailView.receiptId) ??
    null
  )
})

const dispatchReceiptFlowActionAtom = atom(
  null,
  (get, set, action: ReceiptFlowAction) => {
    set(
      receiptFlowStateAtom,
      reduceReceiptFlowState(get(receiptFlowStateAtom), action),
    )
  },
)

export function ReceiptFlowStateProvider({
  children,
  initialState = createReceiptFlowInitialState(),
}: {
  children: ReactNode
  initialState?: ReceiptFlowState
}) {
  const [store] = useState(() => {
    const nextStore = createStore()
    nextStore.set(receiptFlowStateAtom, initialState)
    return nextStore
  })

  return <Provider store={store}>{children}</Provider>
}

export function useReceiptFlowState() {
  const state = useAtomValue(receiptFlowStateAtom)
  const selectedReceipt = useAtomValue(selectedReceiptAtom)

  return {
    ...state,
    selectedReceipt,
  }
}

export function useDispatchReceiptFlowAction() {
  return useSetAtom(dispatchReceiptFlowActionAtom)
}

export function createReceiptFlowInitialState(
  syncState?: ReceiptFlowSyncState,
): ReceiptFlowState {
  return normalizeReceiptFlowState({
    isLoadingReceipts: syncState?.isLoading ?? true,
    receipts: syncState?.receipts ?? [],
    storageError: null,
    view: { kind: 'capture' },
  })
}

export function reduceReceiptFlowState(
  state: ReceiptFlowState,
  action: ReceiptFlowAction,
): ReceiptFlowState {
  switch (action.type) {
    case 'local_load_started':
      return normalizeReceiptFlowState({
        ...state,
        isLoadingReceipts: true,
      })
    case 'local_load_succeeded':
      return normalizeReceiptFlowState({
        ...state,
        isLoadingReceipts: false,
        receipts: action.receipts,
        storageError: null,
      })
    case 'local_load_failed':
      return normalizeReceiptFlowState({
        ...state,
        isLoadingReceipts: false,
        storageError: action.message,
      })
    case 'sync_state_received':
      return normalizeReceiptFlowState({
        ...state,
        isLoadingReceipts: action.syncState.isLoading,
        receipts: action.syncState.receipts ?? state.receipts,
        storageError:
          action.syncState.receipts === undefined ? state.storageError : null,
      })
    case 'view_changed':
      return normalizeReceiptFlowState({
        ...state,
        view: action.view,
      })
    case 'capture_succeeded':
      return normalizeReceiptFlowState({
        ...state,
        receipts: sortSavedReceipts([action.receipt, ...state.receipts]),
        storageError: null,
        view: { kind: 'detail', receiptId: action.receipt.id },
      })
    case 'delete_succeeded':
      return normalizeReceiptFlowState({
        ...state,
        receipts: state.receipts.filter(
          (receipt) => receipt.id !== action.receiptId,
        ),
        storageError: null,
        view: { kind: 'history' },
      })
    case 'reprocess_succeeded':
      return normalizeReceiptFlowState({
        ...state,
        receipts: state.receipts.map((receipt) =>
          receipt.id === action.receipt.id ? action.receipt : receipt,
        ),
        storageError: null,
        view: { kind: 'detail', receiptId: action.receipt.id },
      })
    case 'storage_failed':
      return normalizeReceiptFlowState({
        ...state,
        storageError: action.message,
      })
  }
}

function normalizeReceiptFlowState(state: ReceiptFlowState) {
  if (state.view.kind !== 'detail') {
    return state
  }

  const detailView = state.view

  if (
    !state.isLoadingReceipts &&
    !state.receipts.some((receipt) => receipt.id === detailView.receiptId)
  ) {
    return {
      ...state,
      view: { kind: 'history' as const },
    }
  }

  return state
}

function sortSavedReceipts(receipts: SavedReceipt[]) {
  return [...receipts].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
}
