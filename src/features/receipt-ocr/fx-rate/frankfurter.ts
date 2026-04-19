import type { FxRateProvider } from './provider'
import type { FxRateLookupInput } from './shared'

interface FrankfurterRateResponseItem {
  date?: unknown
  rate?: unknown
}

interface FrankfurterRateProviderOptions {
  fetch?: typeof fetch
}

export function createFrankfurterEcbFxRateProvider(
  options: FrankfurterRateProviderOptions = {},
): FxRateProvider {
  const fetchImplementation = options.fetch ?? globalThis.fetch

  if (typeof fetchImplementation !== 'function') {
    throw new Error('Historical currency conversion is unavailable.')
  }

  return {
    async getRate({
      baseCurrency,
      quoteCurrency,
      requestedDate,
    }: FxRateLookupInput) {
      const searchParams = new URLSearchParams({
        date: requestedDate,
        base: baseCurrency,
        quotes: quoteCurrency,
        providers: 'ECB',
      })
      const response = await fetchImplementation(
        `https://api.frankfurter.dev/v2/rates?${searchParams.toString()}`,
      )

      if (!response.ok) {
        throw new Error('Could not fetch a historical exchange rate.')
      }

      const payload = (await response.json()) as unknown
      const parsed = parseFrankfurterEcbRateResponse(payload)

      return {
        requestedDate,
        effectiveDate: parsed.effectiveDate,
        baseCurrency,
        quoteCurrency,
        rate: parsed.rate,
        provider: 'ECB',
        fetchedAt: new Date().toISOString(),
      }
    },
  }
}

export function parseFrankfurterEcbRateResponse(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Could not fetch a historical exchange rate.')
  }

  const firstEntry = value[0] as FrankfurterRateResponseItem

  if (
    !firstEntry ||
    typeof firstEntry.date !== 'string' ||
    !isIsoDate(firstEntry.date) ||
    typeof firstEntry.rate !== 'number' ||
    !Number.isFinite(firstEntry.rate)
  ) {
    throw new Error('Could not fetch a historical exchange rate.')
  }

  return {
    effectiveDate: firstEntry.date,
    rate: firstEntry.rate,
  }
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}
