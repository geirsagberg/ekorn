import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { logReceiptDebug } from './debug'
import {
  createReceiptFxConversionService,
  type ResolveReceiptFxConversionInput,
} from './fx-rate'
import { loadReceiptImageFile, uploadReceiptImage } from './receipt-flow-image'
import type {
  ReceiptFlowDataSource,
  ReceiptFlowSyncState,
} from './receipt-flow-types'
import type { SavedReceipt } from './saved-receipts'
import { sanitizeReceiptOcrPreviewResult } from './shared'

interface CloudReceiptFlowDataSourceDependencies {
  createReceipt: (args: {
    analysis: SavedReceipt['analysis']
    createdAt: string
    fxConversion: SavedReceipt['fxConversion']
    imageName: string
    imageType: string
    storageId: Id<'_storage'>
  }) => Promise<SavedReceipt>
  deleteReceipt: (args: { receiptId: Id<'receipts'> }) => Promise<null>
  generateUploadUrl: (args: Record<string, never>) => Promise<string>
  resolveFxConversion: (
    input: ResolveReceiptFxConversionInput,
  ) => Promise<SavedReceipt['fxConversion']>
  updateReceipt: (args: {
    analysis: SavedReceipt['analysis']
    fxConversion: SavedReceipt['fxConversion']
    receiptId: Id<'receipts'>
  }) => Promise<SavedReceipt>
}

export function createCloudReceiptFlowDataSource(
  dependencies: CloudReceiptFlowDataSourceDependencies,
): ReceiptFlowDataSource {
  const {
    createReceipt,
    deleteReceipt,
    generateUploadUrl,
    resolveFxConversion,
    updateReceipt,
  } = dependencies

  return {
    async listReceipts() {
      return []
    },
    async captureReceipt({ analysis, imageFile }) {
      const createdAt = new Date().toISOString()
      const sanitizedAnalysis = sanitizeReceiptOcrPreviewResult(analysis)
      const storageId = await uploadReceiptImage({
        file: imageFile,
        generateUploadUrl,
      })
      const fxConversion = await resolveFxConversion({
        analysis: sanitizedAnalysis,
        createdAt,
      })

      return await createReceipt({
        analysis: sanitizedAnalysis,
        createdAt,
        fxConversion,
        imageName: imageFile.name,
        imageType: imageFile.type || 'application/octet-stream',
        storageId,
      })
    },
    async deleteReceipt(receiptId) {
      await deleteReceipt({
        receiptId: receiptId as Id<'receipts'>,
      })
    },
    async reprocessReceipt({ analyzeReceipt, receipt }) {
      const imageFile = await loadReceiptImageFile(receipt)
      const formData = new FormData()
      formData.set('receiptImage', imageFile)

      logReceiptDebug('storage', {
        event: 'receipt_reprocess_requested',
        receiptId: receipt.id,
      })

      const analysis = sanitizeReceiptOcrPreviewResult(
        await analyzeReceipt({ data: formData }),
      )
      const fxConversion = await resolveFxConversion({
        analysis,
        createdAt: receipt.createdAt,
      })

      return await updateReceipt({
        analysis,
        fxConversion,
        receiptId: receipt.id as Id<'receipts'>,
      })
    },
  }
}

export function useConvexReceiptFlowDataSource(): {
  dataSource: ReceiptFlowDataSource
  syncState: ReceiptFlowSyncState
} {
  const receipts = useQuery(api.receipts.list, {})
  const createReceipt = useMutation(api.receipts.create)
  const deleteReceipt = useMutation(api.receipts.remove)
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl)
  const updateReceipt = useMutation(api.receipts.update)
  const [fxConversionService] = useState(() =>
    createReceiptFxConversionService(),
  )

  const dataSource = useMemo(
    () =>
      createCloudReceiptFlowDataSource({
        createReceipt,
        deleteReceipt,
        generateUploadUrl,
        resolveFxConversion: fxConversionService.resolveForReceipt,
        updateReceipt,
      }),
    [
      createReceipt,
      deleteReceipt,
      fxConversionService,
      generateUploadUrl,
      updateReceipt,
    ],
  )

  return {
    dataSource,
    syncState: {
      receipts,
      isLoading: receipts === undefined,
    },
  }
}
