import { useEffect } from 'react'
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
  return (
    <ReceiptFlowStateProvider
      initialState={createReceiptFlowInitialState(syncState)}
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
