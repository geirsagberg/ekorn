import { logReceiptDebug } from './debug'
import { createReceiptFxConversionService } from './fx-rate'
import {
  buildSavedReceipt,
  type CreateSavedReceiptInput,
  type SavedReceipt,
  updateSavedReceipt,
} from './saved-receipts'
import { openReceiptDatabase, RECEIPT_STORE_NAME } from './storage'

export interface ReceiptRepository {
  backfillFxConversions(receipts: SavedReceipt[]): Promise<SavedReceipt[]>
  deleteReceipt(receiptId: string): Promise<void>
  getReceipt(receiptId: string): Promise<SavedReceipt | null>
  listReceipts(): Promise<SavedReceipt[]>
  saveReceipt(input: CreateSavedReceiptInput): Promise<SavedReceipt>
  updateReceipt(input: {
    analysis: CreateSavedReceiptInput['analysis']
    receiptId: string
  }): Promise<SavedReceipt>
}

export const indexedDbReceiptRepository = createIndexedDbReceiptRepository()

export function createIndexedDbReceiptRepository(): ReceiptRepository {
  const fxConversionService = createReceiptFxConversionService()

  return {
    async backfillFxConversions(receipts) {
      const receiptsNeedingBackfill = receipts.filter(
        (receipt) =>
          receipt.fxConversion === undefined || receipt.fxConversion === null,
      )

      if (receiptsNeedingBackfill.length === 0) {
        return receipts
      }

      const updatedReceipts = await Promise.all(
        receipts.map(async (receipt) => {
          if (
            receipt.fxConversion !== undefined &&
            receipt.fxConversion !== null
          ) {
            return receipt
          }

          const fxConversion = await fxConversionService.resolveForReceipt({
            analysis: receipt.analysis,
            createdAt: receipt.createdAt,
          })

          if (fxConversion === null) {
            return {
              ...receipt,
              fxConversion: null,
            }
          }

          return {
            ...receipt,
            fxConversion,
          }
        }),
      )

      const database = await openReceiptDatabase()

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          RECEIPT_STORE_NAME,
          'readwrite',
        )
        const store = transaction.objectStore(RECEIPT_STORE_NAME)

        transaction.oncomplete = () => {
          resolve()
        }
        transaction.onerror = () => {
          reject(transaction.error ?? new Error('Could not update receipt.'))
        }

        updatedReceipts.forEach((receipt) => {
          store.put(receipt)
        })
      })

      return updatedReceipts
    },
    async deleteReceipt(receiptId) {
      const database = await openReceiptDatabase()

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          RECEIPT_STORE_NAME,
          'readwrite',
        )
        const store = transaction.objectStore(RECEIPT_STORE_NAME)

        transaction.oncomplete = () => {
          resolve()
        }
        transaction.onerror = () => {
          reject(transaction.error ?? new Error('Could not delete receipt.'))
        }

        store.delete(receiptId)
      })

      logReceiptDebug('storage', {
        event: 'receipt_deleted',
        receiptId,
        keptStoredCategorization: true,
      })
    },
    async getReceipt(receiptId) {
      const database = await openReceiptDatabase()

      return await new Promise<SavedReceipt | null>((resolve, reject) => {
        const transaction = database.transaction(RECEIPT_STORE_NAME, 'readonly')
        const request = transaction
          .objectStore(RECEIPT_STORE_NAME)
          .get(receiptId)

        request.onsuccess = () => {
          resolve((request.result as SavedReceipt | undefined) ?? null)
        }
        request.onerror = () => {
          reject(request.error ?? new Error('Could not load saved receipt.'))
        }
      })
    },
    async listReceipts() {
      const database = await openReceiptDatabase()

      return await new Promise<SavedReceipt[]>((resolve, reject) => {
        const transaction = database.transaction(RECEIPT_STORE_NAME, 'readonly')
        const store = transaction.objectStore(RECEIPT_STORE_NAME)
        const request = store.getAll()

        request.onsuccess = () => {
          const receipts = (request.result as SavedReceipt[]).sort(
            (left, right) => right.createdAt.localeCompare(left.createdAt),
          )
          resolve(receipts)
        }
        request.onerror = () => {
          reject(request.error ?? new Error('Could not load saved receipts.'))
        }
      })
    },
    async saveReceipt(input) {
      const createdAt = input.createdAt ?? new Date().toISOString()
      const fxConversion = await fxConversionService.resolveForReceipt({
        analysis: input.analysis,
        createdAt,
      })
      const receipt = buildSavedReceipt({
        ...input,
        createdAt,
        fxConversion,
      })
      const database = await openReceiptDatabase()

      return await new Promise<SavedReceipt>((resolve, reject) => {
        const transaction = database.transaction(
          RECEIPT_STORE_NAME,
          'readwrite',
        )
        const store = transaction.objectStore(RECEIPT_STORE_NAME)

        transaction.oncomplete = () => {
          resolve(receipt)
        }
        transaction.onerror = () => {
          reject(transaction.error ?? new Error('Could not save receipt.'))
        }

        store.put(receipt)
      })
    },
    async updateReceipt({ analysis, receiptId }) {
      const existingReceipt = await this.getReceipt(receiptId)

      if (!existingReceipt) {
        throw new Error('Could not find this receipt to update.')
      }

      const fxConversion = await fxConversionService.resolveForReceipt({
        analysis,
        createdAt: existingReceipt.createdAt,
      })
      const updatedReceipt = updateSavedReceipt({
        analysis,
        fxConversion,
        receipt: existingReceipt,
      })
      const database = await openReceiptDatabase()

      return await new Promise<SavedReceipt>((resolve, reject) => {
        const transaction = database.transaction(
          RECEIPT_STORE_NAME,
          'readwrite',
        )
        const store = transaction.objectStore(RECEIPT_STORE_NAME)

        transaction.oncomplete = () => {
          resolve(updatedReceipt)
        }
        transaction.onerror = () => {
          reject(transaction.error ?? new Error('Could not update receipt.'))
        }

        store.put(updatedReceipt)
      })
    },
  }
}
