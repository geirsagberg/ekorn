import { logReceiptDebug } from './debug'
import { analyzeReceiptImageFile } from './receipt-analysis-file'
import { loadReceiptImageFile } from './receipt-flow-image'
import type { ReceiptFlowDataSource } from './receipt-flow-types'
import {
  indexedDbReceiptRepository,
  type ReceiptRepository,
} from './receipt-repository'

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

      logReceiptDebug('storage', {
        event: 'receipt_reprocess_requested',
        receiptId: receipt.id,
      })

      const { analysis } = await analyzeReceiptImageFile({
        analyzeReceipt,
        file: imageFile,
      })

      return await receiptRepository.updateReceipt({
        analysis,
        receiptId: receipt.id,
      })
    },
  }
}
