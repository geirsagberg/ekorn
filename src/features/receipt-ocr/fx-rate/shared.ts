export type FxRateProviderName = 'ECB'

export interface FxRateRecord {
  requestedDate: string
  effectiveDate: string
  baseCurrency: string
  quoteCurrency: string
  rate: number
  provider: FxRateProviderName
  fetchedAt: string
}

export interface SavedReceiptFxConversion {
  sourceCurrency: string
  targetCurrency: string
  basisDate: string
  basisKind: 'purchase_date' | 'capture_date_fallback'
  effectiveRateDate: string | null
  rate: number | null
  provider: FxRateProviderName
  convertedTotal: number | null
  convertedSubtotal: number | null
  conversionStatus: 'exact' | 'fallback_cached' | 'unavailable'
}

export interface FxRateLookupInput {
  baseCurrency: string
  quoteCurrency: string
  requestedDate: string
}
