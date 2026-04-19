import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { logReceiptDebug } from './debug'
import { createReceiptFxConversionService } from './fx-rate'
import {
  indexedDbReceiptRepository,
  type ReceiptRepository,
} from './receipt-repository'
import type { SavedReceipt } from './saved-receipts'
import {
  type AnalyzeReceiptFn,
  type ReceiptOcrPreviewResult,
  sanitizeReceiptOcrPreviewResult,
} from './shared'

export interface ReceiptFlowDataSource {
  listReceipts(): Promise<SavedReceipt[]>
  captureReceipt(input: {
    analysis: ReceiptOcrPreviewResult
    imageFile: File
  }): Promise<SavedReceipt>
  deleteReceipt(receiptId: string): Promise<void>
  reprocessReceipt(input: {
    receipt: SavedReceipt
    analyzeReceipt: AnalyzeReceiptFn
  }): Promise<SavedReceipt>
}

export interface ReceiptFlowSyncState {
  receipts: SavedReceipt[] | undefined
  isLoading: boolean
}

export function createIndexedDbReceiptFlowDataSource(
  receiptRepository: ReceiptRepository = indexedDbReceiptRepository,
): ReceiptFlowDataSource {
  return {
    async listReceipts() {
      const savedReceipts = await receiptRepository.listReceipts()

      try {
        return await receiptRepository.backfillFxConversions(savedReceipts)
      } catch {
        // Keep the initial receipt list visible even if FX backfill fails.
        return savedReceipts
      }
    },
    async captureReceipt({ analysis, imageFile }) {
      return await receiptRepository.saveReceipt({
        analysis,
        imageFile,
      })
    },
    async deleteReceipt(receiptId) {
      await receiptRepository.deleteReceipt(receiptId)
    },
    async reprocessReceipt({ analyzeReceipt, receipt }) {
      const imageFile = await loadReceiptImageFile(receipt)
      const formData = new FormData()
      formData.set('receiptImage', imageFile)

      logReceiptDebug('storage', {
        event: 'receipt_reprocess_requested',
        receiptId: receipt.id,
      })

      const analysis = await analyzeReceipt({ data: formData })

      return await receiptRepository.updateReceipt({
        analysis,
        receiptId: receipt.id,
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

  const dataSource = useMemo<ReceiptFlowDataSource>(
    () => ({
      async listReceipts() {
        return receipts ?? []
      },
      async captureReceipt({ analysis, imageFile }) {
        const createdAt = new Date().toISOString()
        const sanitizedAnalysis = sanitizeReceiptOcrPreviewResult(analysis)
        const storageId = await uploadReceiptImage({
          file: imageFile,
          generateUploadUrl,
        })
        const fxConversion = await fxConversionService.resolveForReceipt({
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
        const fxConversion = await fxConversionService.resolveForReceipt({
          analysis,
          createdAt: receipt.createdAt,
        })

        return await updateReceipt({
          analysis,
          fxConversion,
          receiptId: receipt.id as Id<'receipts'>,
        })
      },
    }),
    [
      createReceipt,
      deleteReceipt,
      fxConversionService,
      generateUploadUrl,
      receipts,
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

async function loadReceiptImageFile(receipt: SavedReceipt) {
  if (receipt.imageBlob) {
    return new File([receipt.imageBlob], receipt.imageName, {
      type: receipt.imageType,
    })
  }

  if (!receipt.imageUrl) {
    throw new Error('This receipt image is no longer available.')
  }

  const response = await fetch(receipt.imageUrl)

  if (!response.ok) {
    throw new Error('Could not load this receipt image.')
  }

  const imageBlob = await response.blob()

  return new File([imageBlob], receipt.imageName, {
    type: receipt.imageType || imageBlob.type || 'application/octet-stream',
  })
}

async function uploadReceiptImage({
  file,
  generateUploadUrl,
}: {
  file: File
  generateUploadUrl: (args: Record<string, never>) => Promise<string>
}) {
  const uploadUrl = await generateUploadUrl({})
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error('Could not upload this receipt image.')
  }

  const result = (await response.json()) as {
    storageId?: Id<'_storage'>
  }

  if (!result.storageId) {
    throw new Error('Could not store this receipt image.')
  }

  return result.storageId
}
