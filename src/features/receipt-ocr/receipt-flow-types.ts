import type { SavedReceipt } from './saved-receipts'
import type { AnalyzeReceiptFn, ReceiptOcrPreviewResult } from './shared'

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
