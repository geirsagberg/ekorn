import { RECEIPT_HOME_CURRENCY } from '../receipt-config'
import type { ReceiptOcrPreviewResult } from '../shared'
import { type FxRateCache, indexedDbFxRateCache } from './cache'
import { createFrankfurterEcbFxRateProvider } from './frankfurter'
import type { FxRateProvider } from './provider'
import type { SavedReceiptFxConversion } from './shared'

interface ReceiptFxConversionServiceOptions {
  cache?: FxRateCache
  provider?: FxRateProvider
  targetCurrency?: string
}

export interface ResolveReceiptFxConversionInput {
  analysis: Pick<
    ReceiptOcrPreviewResult,
    'currency' | 'purchaseDate' | 'subtotal' | 'total'
  >
  createdAt: string
}

export function createReceiptFxConversionService(
  options: ReceiptFxConversionServiceOptions = {},
) {
  const cache = options.cache ?? indexedDbFxRateCache
  const provider = options.provider ?? createFrankfurterEcbFxRateProvider()
  const targetCurrency = (
    options.targetCurrency ?? RECEIPT_HOME_CURRENCY
  ).toUpperCase()

  return {
    async resolveForReceipt({
      analysis,
      createdAt,
    }: ResolveReceiptFxConversionInput): Promise<SavedReceiptFxConversion | null> {
      const sourceCurrency = normalizeCurrencyCode(analysis.currency)

      if (!sourceCurrency || sourceCurrency === targetCurrency) {
        return null
      }

      const basisKind = analysis.purchaseDate
        ? 'purchase_date'
        : 'capture_date_fallback'
      const basisDate = analysis.purchaseDate ?? toLocalIsoDate(createdAt)
      const cacheLookup = {
        provider: 'ECB' as const,
        baseCurrency: sourceCurrency,
        quoteCurrency: targetCurrency,
        requestedDate: basisDate,
      }

      const exactMatch = await cache.getExact(cacheLookup)

      if (exactMatch) {
        return buildReceiptFxConversionSnapshot({
          rateRecord: exactMatch,
          conversionStatus: 'exact',
          analysis,
          basisDate,
          basisKind,
          targetCurrency,
        })
      }

      try {
        const rateRecord = await provider.getRate(cacheLookup)
        await cache.put(rateRecord)

        return buildReceiptFxConversionSnapshot({
          rateRecord,
          conversionStatus: 'exact',
          analysis,
          basisDate,
          basisKind,
          targetCurrency,
        })
      } catch {
        const fallback = await cache.getFallback(cacheLookup)

        if (fallback) {
          return buildReceiptFxConversionSnapshot({
            rateRecord: fallback,
            conversionStatus: 'fallback_cached',
            analysis,
            basisDate,
            basisKind,
            targetCurrency,
          })
        }

        return {
          sourceCurrency,
          targetCurrency,
          basisDate,
          basisKind,
          effectiveRateDate: null,
          rate: null,
          provider: 'ECB',
          convertedTotal: null,
          convertedSubtotal: null,
          conversionStatus: 'unavailable',
        }
      }
    },
  }
}

export function buildReceiptFxConversionSnapshot({
  analysis,
  basisDate,
  basisKind,
  conversionStatus,
  rateRecord,
  targetCurrency,
}: {
  analysis: Pick<ReceiptOcrPreviewResult, 'currency' | 'subtotal' | 'total'>
  basisDate: string
  basisKind: SavedReceiptFxConversion['basisKind']
  conversionStatus: SavedReceiptFxConversion['conversionStatus']
  rateRecord: {
    baseCurrency: string
    effectiveDate: string
    provider: SavedReceiptFxConversion['provider']
    rate: number
  }
  targetCurrency: string
}): SavedReceiptFxConversion {
  return {
    sourceCurrency: rateRecord.baseCurrency,
    targetCurrency,
    basisDate,
    basisKind,
    effectiveRateDate: rateRecord.effectiveDate,
    rate: rateRecord.rate,
    provider: rateRecord.provider,
    convertedTotal: convertCurrencyAmount(analysis.total, rateRecord.rate),
    convertedSubtotal: convertCurrencyAmount(
      analysis.subtotal,
      rateRecord.rate,
    ),
    conversionStatus,
  }
}

export function convertCurrencyAmount(amount: number | null, rate: number) {
  if (amount === null) {
    return null
  }

  return Math.round(amount * rate * 100) / 100
}

export function toLocalIsoDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeCurrencyCode(value: string | null) {
  return value?.trim().toUpperCase() || null
}
