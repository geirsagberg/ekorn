import { useEffect, useRef } from 'react'
import type {
  ReceiptFlowDataSource,
  ReceiptFlowSyncState,
} from './receipt-flow-data-source'
import { ReceiptFlowScreen, type ReceiptFlowView } from './receipt-flow-screen'
import {
  createReceiptFlowInitialState,
  ReceiptFlowStateProvider,
  useDispatchReceiptFlowAction,
  useReceiptFlowState,
} from './receipt-flow-state'
import type { AnalyzeReceiptFn } from './shared'

interface ReceiptFlowAppProps {
  analyzeReceipt: AnalyzeReceiptFn
  dataSource: ReceiptFlowDataSource
  syncState?: ReceiptFlowSyncState
}

export function ReceiptFlowApp({
  analyzeReceipt,
  dataSource,
  syncState,
}: ReceiptFlowAppProps) {
  const initialView = getInitialReceiptFlowView()

  return (
    <ReceiptFlowStateProvider
      initialState={createReceiptFlowInitialState(syncState, initialView)}
    >
      <ReceiptFlowAppContent
        analyzeReceipt={analyzeReceipt}
        dataSource={dataSource}
        syncState={syncState}
      />
    </ReceiptFlowStateProvider>
  )
}

function ReceiptFlowAppContent({
  analyzeReceipt,
  dataSource,
  syncState,
}: ReceiptFlowAppProps) {
  const dispatch = useDispatchReceiptFlowAction()
  const { isLoadingReceipts, receipts, selectedReceipt, storageError, view } =
    useReceiptFlowState()
  const previousViewRef = useRef<ReceiptFlowView | null>(null)

  useEffect(() => {
    if (syncState) {
      return
    }

    let isActive = true

    dispatch({ type: 'local_load_started' })

    void dataSource
      .listReceipts()
      .then((savedReceipts) => {
        if (!isActive) {
          return
        }

        dispatch({
          type: 'local_load_succeeded',
          receipts: savedReceipts,
        })
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        dispatch({
          type: 'local_load_failed',
          message: toStorageErrorMessage(error),
        })
      })

    return () => {
      isActive = false
    }
  }, [dataSource, dispatch, syncState])

  useEffect(() => {
    if (!syncState) {
      return
    }

    dispatch({
      type: 'sync_state_received',
      syncState,
    })
  }, [dispatch, syncState])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePopState = () => {
      dispatch({
        type: 'view_changed',
        view: getCurrentReceiptFlowView(),
      })
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [dispatch])

  useEffect(() => {
    if (typeof window === 'undefined') {
      previousViewRef.current = view
      return
    }

    const nextHash = buildReceiptFlowHash(view)

    if (window.location.hash === nextHash) {
      previousViewRef.current = view
      return
    }

    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`
    const shouldPushHistoryEntry =
      view.kind === 'detail' &&
      (previousViewRef.current?.kind !== 'detail' ||
        previousViewRef.current.receiptId !== view.receiptId)

    window.history[shouldPushHistoryEntry ? 'pushState' : 'replaceState'](
      shouldPushHistoryEntry
        ? {
            receiptFlowPreviousView: previousViewRef.current ?? {
              kind: 'capture',
            },
          }
        : null,
      '',
      nextUrl,
    )
    previousViewRef.current = view
  }, [view])

  return (
    <ReceiptFlowScreen
      analyzeReceipt={analyzeReceipt}
      isLoadingReceipts={isLoadingReceipts}
      onCaptureSuccess={async (capture) => {
        try {
          const savedReceipt = await dataSource.captureReceipt(capture)

          dispatch({
            type: 'capture_succeeded',
            receipt: savedReceipt,
          })
        } catch (error) {
          throw new Error(toStorageErrorMessage(error))
        }
      }}
      onDeleteReceipt={async (receiptId) => {
        try {
          await dataSource.deleteReceipt(receiptId)

          dispatch({
            type: 'delete_succeeded',
            receiptId,
          })
        } catch (error) {
          dispatch({
            type: 'storage_failed',
            message: toStorageErrorMessage(error),
          })
          throw error
        }
      }}
      onOpenReceipt={(receiptId) => {
        dispatch({
          type: 'view_changed',
          view: { kind: 'detail', receiptId },
        })
      }}
      onReprocessReceipt={async (receipt) => {
        try {
          const updatedReceipt = await dataSource.reprocessReceipt({
            analyzeReceipt,
            receipt,
          })

          dispatch({
            type: 'reprocess_succeeded',
            receipt: updatedReceipt,
          })
        } catch (error) {
          dispatch({
            type: 'storage_failed',
            message: toStorageErrorMessage(error),
          })
          throw error
        }
      }}
      receipts={receipts}
      selectedReceipt={selectedReceipt}
      storageError={storageError}
      view={view}
      onViewChange={(nextView: ReceiptFlowView) => {
        if (
          typeof window !== 'undefined' &&
          view.kind === 'detail' &&
          nextView.kind === 'history' &&
          getCurrentReceiptFlowView().kind === 'detail' &&
          window.history.state?.receiptFlowPreviousView?.kind === 'history'
        ) {
          window.history.back()
          return
        }

        dispatch({
          type: 'view_changed',
          view: nextView,
        })
      }}
    />
  )
}

function toStorageErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Could not update your receipt history.'
}

const HISTORY_HASH = '#history'
const DETAIL_HASH_PREFIX = '#receipt/'

function getInitialReceiptFlowView(): ReceiptFlowView {
  if (typeof window === 'undefined') {
    return { kind: 'capture' }
  }

  return getCurrentReceiptFlowView()
}

function getCurrentReceiptFlowView(): ReceiptFlowView {
  if (typeof window === 'undefined') {
    return { kind: 'capture' }
  }

  return parseReceiptFlowHash(window.location.hash)
}

function parseReceiptFlowHash(hash: string): ReceiptFlowView {
  if (hash === HISTORY_HASH) {
    return { kind: 'history' }
  }

  if (hash.startsWith(DETAIL_HASH_PREFIX)) {
    const receiptId = decodeURIComponent(hash.slice(DETAIL_HASH_PREFIX.length))

    if (receiptId.length > 0) {
      return { kind: 'detail', receiptId }
    }

    return { kind: 'history' }
  }

  return { kind: 'capture' }
}

function buildReceiptFlowHash(view: ReceiptFlowView) {
  switch (view.kind) {
    case 'capture':
      return ''
    case 'history':
      return HISTORY_HASH
    case 'detail':
      return `${DETAIL_HASH_PREFIX}${encodeURIComponent(view.receiptId)}`
  }
}
