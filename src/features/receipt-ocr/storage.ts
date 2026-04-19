const RECEIPT_DB_NAME = 'ekorn-receipts'
const RECEIPT_DB_VERSION = 2

export const RECEIPT_STORE_NAME = 'receipts'
export const FX_RATE_STORE_NAME = 'fx-rates'
export const FX_RATE_PAIR_INDEX =
  'by_provider_and_base_currency_and_quote_currency'

let receiptDatabasePromise: Promise<IDBDatabase> | null = null

export function openReceiptDatabase() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('Receipt storage is unavailable on this device.')
  }

  if (!receiptDatabasePromise) {
    receiptDatabasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(RECEIPT_DB_NAME, RECEIPT_DB_VERSION)

      request.onupgradeneeded = () => {
        const database = request.result

        if (!database.objectStoreNames.contains(RECEIPT_STORE_NAME)) {
          database.createObjectStore(RECEIPT_STORE_NAME, { keyPath: 'id' })
        }

        if (!database.objectStoreNames.contains(FX_RATE_STORE_NAME)) {
          const store = database.createObjectStore(FX_RATE_STORE_NAME, {
            keyPath: 'cacheKey',
          })
          store.createIndex(FX_RATE_PAIR_INDEX, [
            'provider',
            'baseCurrency',
            'quoteCurrency',
          ])
        }
      }

      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        receiptDatabasePromise = null
        reject(request.error ?? new Error('Could not open receipt storage.'))
      }
    })
  }

  return receiptDatabasePromise
}
