import { useEffect, useState } from 'react'
import type {
  ReceiptFlowDataSource,
  ReceiptFlowSyncState,
} from './receipt-flow-data-source'
import { ReceiptFlowScreen, type ReceiptFlowView } from './receipt-flow-screen'
import type { SavedReceipt } from './saved-receipts'
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
  const [receipts, setReceipts] = useState<SavedReceipt[]>([])
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(
    syncState?.isLoading ?? true,
  )
  const [storageError, setStorageError] = useState<string | null>(null)
  const [view, setView] = useState<ReceiptFlowView>({ kind: 'capture' })

  const selectedReceipt =
    view.kind === 'detail'
      ? (receipts.find((receipt) => receipt.id === view.receiptId) ?? null)
      : null

  useEffect(() => {
    if (syncState) {
      return
    }

    let isActive = true

    setIsLoadingReceipts(true)

    void dataSource
      .listReceipts()
      .then((savedReceipts) => {
        if (!isActive) {
          return
        }

        setReceipts(savedReceipts)
        setStorageError(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setStorageError(toStorageErrorMessage(error))
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingReceipts(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [dataSource, syncState])

  useEffect(() => {
    if (!syncState) {
      return
    }

    setIsLoadingReceipts(syncState.isLoading)

    if (syncState.receipts === undefined) {
      return
    }

    setReceipts(syncState.receipts)
    setStorageError(null)
  }, [syncState])

  useEffect(() => {
    if (view.kind === 'detail' && !selectedReceipt && !isLoadingReceipts) {
      setView({ kind: 'history' })
    }
  }, [isLoadingReceipts, selectedReceipt, view])

  return (
    <ReceiptFlowScreen
      analyzeReceipt={analyzeReceipt}
      isLoadingReceipts={isLoadingReceipts}
      onCaptureSuccess={async (capture) => {
        try {
          const savedReceipt = await dataSource.captureReceipt(capture)

          setReceipts((currentReceipts) =>
            sortSavedReceipts([savedReceipt, ...currentReceipts]),
          )
          setStorageError(null)
          setView({ kind: 'detail', receiptId: savedReceipt.id })
        } catch (error) {
          throw new Error(toStorageErrorMessage(error))
        }
      }}
      onDeleteReceipt={async (receiptId) => {
        try {
          await dataSource.deleteReceipt(receiptId)

          setReceipts((currentReceipts) =>
            currentReceipts.filter((receipt) => receipt.id !== receiptId),
          )
          setStorageError(null)
          setView({ kind: 'history' })
        } catch (error) {
          setStorageError(toStorageErrorMessage(error))
          throw error
        }
      }}
      onOpenReceipt={(receiptId) => {
        setView({ kind: 'detail', receiptId })
      }}
      onReprocessReceipt={async (receipt) => {
        try {
          const updatedReceipt = await dataSource.reprocessReceipt({
            analyzeReceipt,
            receipt,
          })

          setReceipts((currentReceipts) =>
            currentReceipts.map((currentReceipt) =>
              currentReceipt.id === updatedReceipt.id
                ? updatedReceipt
                : currentReceipt,
            ),
          )
          setStorageError(null)
          setView({ kind: 'detail', receiptId: updatedReceipt.id })
        } catch (error) {
          setStorageError(toStorageErrorMessage(error))
          throw error
        }
      }}
      receipts={receipts}
      selectedReceipt={selectedReceipt}
      storageError={storageError}
      view={view}
      onViewChange={setView}
    />
  )
}

function toStorageErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Could not update your receipt history.'
}

function sortSavedReceipts(receipts: SavedReceipt[]) {
  return [...receipts].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
}
