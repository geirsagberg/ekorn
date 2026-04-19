import {
  FX_RATE_PAIR_INDEX,
  FX_RATE_STORE_NAME,
  openReceiptDatabase,
} from '../storage'
import type {
  FxRateLookupInput,
  FxRateProviderName,
  FxRateRecord,
} from './shared'

interface StoredFxRateRecord extends FxRateRecord {
  cacheKey: string
}

export interface FxRateCache {
  getFallback(
    input: FxRateLookupInput & { provider: FxRateProviderName },
  ): Promise<FxRateRecord | null>
  getExact(
    input: FxRateLookupInput & { provider: FxRateProviderName },
  ): Promise<FxRateRecord | null>
  put(record: FxRateRecord): Promise<void>
}

export const indexedDbFxRateCache = createIndexedDbFxRateCache()

export function createIndexedDbFxRateCache(): FxRateCache {
  return {
    async getExact({ baseCurrency, provider, quoteCurrency, requestedDate }) {
      const database = await openReceiptDatabase()

      return await new Promise<FxRateRecord | null>((resolve, reject) => {
        const transaction = database.transaction(FX_RATE_STORE_NAME, 'readonly')
        const request = transaction.objectStore(FX_RATE_STORE_NAME).get(
          createFxRateCacheKey({
            provider,
            baseCurrency,
            quoteCurrency,
            requestedDate,
          }),
        )

        request.onsuccess = () => {
          resolve(
            stripFxRateCacheKey(
              request.result as StoredFxRateRecord | undefined,
            ),
          )
        }
        request.onerror = () => {
          reject(
            request.error ?? new Error('Could not load cached exchange rates.'),
          )
        }
      })
    },
    async getFallback({
      baseCurrency,
      provider,
      quoteCurrency,
      requestedDate,
    }) {
      const database = await openReceiptDatabase()

      return await new Promise<FxRateRecord | null>((resolve, reject) => {
        const transaction = database.transaction(FX_RATE_STORE_NAME, 'readonly')
        const request = transaction
          .objectStore(FX_RATE_STORE_NAME)
          .index(FX_RATE_PAIR_INDEX)
          .getAll([provider, baseCurrency, quoteCurrency])

        request.onsuccess = () => {
          const matches = (request.result as StoredFxRateRecord[])
            .filter((record) => record.effectiveDate <= requestedDate)
            .sort((left, right) => {
              if (left.effectiveDate === right.effectiveDate) {
                return right.fetchedAt.localeCompare(left.fetchedAt)
              }

              return right.effectiveDate.localeCompare(left.effectiveDate)
            })

          resolve(stripFxRateCacheKey(matches[0]))
        }
        request.onerror = () => {
          reject(
            request.error ?? new Error('Could not load cached exchange rates.'),
          )
        }
      })
    },
    async put(record) {
      const database = await openReceiptDatabase()
      const storedRecord = addFxRateCacheKey(record)

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          FX_RATE_STORE_NAME,
          'readwrite',
        )
        const store = transaction.objectStore(FX_RATE_STORE_NAME)

        transaction.oncomplete = () => {
          resolve()
        }
        transaction.onerror = () => {
          reject(
            transaction.error ??
              new Error('Could not store cached exchange rate.'),
          )
        }

        store.put(storedRecord)
      })
    },
  }
}

export function createFxRateCacheKey({
  baseCurrency,
  provider,
  quoteCurrency,
  requestedDate,
}: FxRateLookupInput & { provider: FxRateProviderName }) {
  return [provider, baseCurrency, quoteCurrency, requestedDate].join(':')
}

function addFxRateCacheKey(record: FxRateRecord): StoredFxRateRecord {
  return {
    ...record,
    cacheKey: createFxRateCacheKey(record),
  }
}

function stripFxRateCacheKey(record: StoredFxRateRecord | undefined) {
  if (!record) {
    return null
  }

  const { cacheKey: _cacheKey, ...rateRecord } = record
  return rateRecord
}
