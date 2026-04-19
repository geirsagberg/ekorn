import { logReceiptDebug } from './debug'
import type { SavedReceiptFxConversion } from './fx-rate/shared'
import {
  type ReceiptOcrPreviewResult,
  sanitizeReceiptOcrPreviewResult,
} from './shared'

export type SavedReceiptStatus = 'ready' | 'needs-review'

export interface SavedReceipt {
  id: string
  createdAt: string
  merchant: string | null
  total: number | null
  subtotal: number | null
  currency: string | null
  status: SavedReceiptStatus
  fxConversion: SavedReceiptFxConversion | null
  imageBlob: Blob | null
  imageName: string
  imageType: string
  imageUrl: string | null
  imageStorageId: string | null
  analysis: ReceiptOcrPreviewResult
}

export interface CreateSavedReceiptInput {
  analysis: ReceiptOcrPreviewResult
  createdAt?: string
  fxConversion?: SavedReceiptFxConversion | null
  imageFile: File
}

export interface UpdateSavedReceiptInput {
  analysis: ReceiptOcrPreviewResult
  fxConversion?: SavedReceiptFxConversion | null
  receipt: SavedReceipt
}

export function buildSavedReceipt({
  analysis,
  createdAt,
  fxConversion = null,
  imageFile,
}: CreateSavedReceiptInput): SavedReceipt {
  const sanitizedAnalysis = sanitizeReceiptOcrPreviewResult(analysis)
  const savedReceipt = {
    id: createSavedReceiptId(),
    createdAt: createdAt ?? new Date().toISOString(),
    merchant: sanitizedAnalysis.merchantName,
    total: sanitizedAnalysis.total,
    subtotal: sanitizedAnalysis.subtotal,
    currency: sanitizedAnalysis.currency,
    status: deriveSavedReceiptStatus(sanitizedAnalysis),
    fxConversion,
    imageBlob: imageFile,
    imageName: imageFile.name,
    imageType: imageFile.type,
    imageUrl: null,
    imageStorageId: null,
    analysis: sanitizedAnalysis,
  }

  logReceiptDebug('storage', {
    event: 'saved_receipt_built',
    merchantName: savedReceipt.merchant,
    usedUnknownMerchantFallback: savedReceipt.merchant === null,
  })

  return savedReceipt
}

export function deriveSavedReceiptStatus(
  analysis: ReceiptOcrPreviewResult,
): SavedReceiptStatus {
  if (analysis.sanityCheck.status === 'warning') {
    return 'needs-review'
  }

  if (analysis.items.some((item) => item.isLowConfidence)) {
    return 'needs-review'
  }

  return 'ready'
}

export function getSavedReceiptStatusLabel(status: SavedReceiptStatus) {
  return status === 'needs-review' ? 'Needs review' : 'Ready'
}

export function getSavedReceiptMerchantLabel(merchant: string | null) {
  return merchant?.trim() || 'Unknown merchant'
}

export function updateSavedReceipt({
  analysis,
  fxConversion = null,
  receipt,
}: UpdateSavedReceiptInput): SavedReceipt {
  const sanitizedAnalysis = sanitizeReceiptOcrPreviewResult(analysis)
  const updatedReceipt = {
    ...receipt,
    merchant: sanitizedAnalysis.merchantName,
    total: sanitizedAnalysis.total,
    subtotal: sanitizedAnalysis.subtotal,
    currency: sanitizedAnalysis.currency,
    status: deriveSavedReceiptStatus(sanitizedAnalysis),
    fxConversion,
    analysis: sanitizedAnalysis,
  }

  logReceiptDebug('storage', {
    event: 'saved_receipt_updated',
    merchantName: updatedReceipt.merchant,
    receiptId: updatedReceipt.id,
    usedUnknownMerchantFallback: updatedReceipt.merchant === null,
  })

  return updatedReceipt
}

function createSavedReceiptId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
