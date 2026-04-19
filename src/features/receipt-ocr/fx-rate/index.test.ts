import { describe, expect, it, vi } from 'vitest'
import type { FxRateCache } from './cache'
import {
  buildReceiptFxConversionSnapshot,
  convertCurrencyAmount,
  createReceiptFxConversionService,
} from './index'
import type { FxRateProvider } from './provider'

describe('convertCurrencyAmount', () => {
  it('rounds converted amounts to cents', () => {
    expect(convertCurrencyAmount(10, 11.017)).toBe(110.17)
  })
})

describe('buildReceiptFxConversionSnapshot', () => {
  it('converts subtotal and total amounts into the target currency', () => {
    expect(
      buildReceiptFxConversionSnapshot({
        analysis: {
          currency: 'EUR',
          subtotal: 8.5,
          total: 10,
        },
        basisDate: '2026-04-18',
        basisKind: 'purchase_date',
        conversionStatus: 'exact',
        rateRecord: {
          baseCurrency: 'EUR',
          effectiveDate: '2026-04-17',
          provider: 'ECB',
          rate: 11.017,
        },
        targetCurrency: 'NOK',
      }),
    ).toEqual({
      sourceCurrency: 'EUR',
      targetCurrency: 'NOK',
      basisDate: '2026-04-18',
      basisKind: 'purchase_date',
      effectiveRateDate: '2026-04-17',
      rate: 11.017,
      provider: 'ECB',
      convertedTotal: 110.17,
      convertedSubtotal: 93.64,
      conversionStatus: 'exact',
    })
  })
})

describe('createReceiptFxConversionService', () => {
  it('uses an exact cached rate without calling the network provider', async () => {
    const cache = createCacheMock({
      exact: {
        requestedDate: '2026-04-18',
        effectiveDate: '2026-04-17',
        baseCurrency: 'EUR',
        quoteCurrency: 'NOK',
        rate: 11.017,
        provider: 'ECB',
        fetchedAt: '2026-04-19T09:00:00.000Z',
      },
    })
    const provider = createProviderMock()
    const service = createReceiptFxConversionService({
      cache,
      provider,
      targetCurrency: 'NOK',
    })

    const result = await service.resolveForReceipt({
      analysis: {
        currency: 'EUR',
        purchaseDate: '2026-04-18',
        subtotal: 8.5,
        total: 10,
      },
      createdAt: '2026-04-19T08:30:00.000Z',
    })

    expect(provider.getRate).not.toHaveBeenCalled()
    expect(result?.conversionStatus).toBe('exact')
    expect(result?.convertedTotal).toBe(110.17)
  })

  it('fetches and caches a rate when the cache misses', async () => {
    const cache = createCacheMock()
    const provider = createProviderMock({
      requestedDate: '2026-04-18',
      effectiveDate: '2026-04-17',
      baseCurrency: 'EUR',
      quoteCurrency: 'NOK',
      rate: 11.017,
      provider: 'ECB',
      fetchedAt: '2026-04-19T09:00:00.000Z',
    })
    const service = createReceiptFxConversionService({
      cache,
      provider,
      targetCurrency: 'NOK',
    })

    const result = await service.resolveForReceipt({
      analysis: {
        currency: 'EUR',
        purchaseDate: '2026-04-18',
        subtotal: 8.5,
        total: 10,
      },
      createdAt: '2026-04-19T08:30:00.000Z',
    })

    expect(provider.getRate).toHaveBeenCalledTimes(1)
    expect(cache.put).toHaveBeenCalledTimes(1)
    expect(result?.conversionStatus).toBe('exact')
  })

  it('falls back to the newest cached rate on or before the requested date when fetching fails', async () => {
    const cache = createCacheMock({
      fallback: {
        requestedDate: '2026-04-17',
        effectiveDate: '2026-04-17',
        baseCurrency: 'EUR',
        quoteCurrency: 'NOK',
        rate: 11.017,
        provider: 'ECB',
        fetchedAt: '2026-04-19T09:00:00.000Z',
      },
    })
    const provider = createProviderMock(new Error('network failed'))
    const service = createReceiptFxConversionService({
      cache,
      provider,
      targetCurrency: 'NOK',
    })

    const result = await service.resolveForReceipt({
      analysis: {
        currency: 'EUR',
        purchaseDate: '2026-04-18',
        subtotal: 8.5,
        total: 10,
      },
      createdAt: '2026-04-19T08:30:00.000Z',
    })

    expect(result?.conversionStatus).toBe('fallback_cached')
    expect(result?.effectiveRateDate).toBe('2026-04-17')
  })

  it('marks conversion unavailable when neither fetch nor cached fallback succeeds', async () => {
    const cache = createCacheMock()
    const provider = createProviderMock(new Error('network failed'))
    const service = createReceiptFxConversionService({
      cache,
      provider,
      targetCurrency: 'NOK',
    })

    const result = await service.resolveForReceipt({
      analysis: {
        currency: 'EUR',
        purchaseDate: null,
        subtotal: 8.5,
        total: 10,
      },
      createdAt: '2026-04-19T08:30:00.000Z',
    })

    expect(result).toEqual({
      sourceCurrency: 'EUR',
      targetCurrency: 'NOK',
      basisDate: '2026-04-19',
      basisKind: 'capture_date_fallback',
      effectiveRateDate: null,
      rate: null,
      provider: 'ECB',
      convertedTotal: null,
      convertedSubtotal: null,
      conversionStatus: 'unavailable',
    })
  })
})

function createCacheMock(
  values: {
    exact?: Awaited<ReturnType<FxRateCache['getExact']>>
    fallback?: Awaited<ReturnType<FxRateCache['getFallback']>>
  } = {},
): FxRateCache & {
  put: ReturnType<typeof vi.fn>
} {
  return {
    getExact: vi.fn().mockResolvedValue(values.exact ?? null),
    getFallback: vi.fn().mockResolvedValue(values.fallback ?? null),
    put: vi.fn().mockResolvedValue(undefined),
  }
}

function createProviderMock(
  result?: Awaited<ReturnType<FxRateProvider['getRate']>> | Error,
): FxRateProvider {
  return {
    getRate:
      result instanceof Error
        ? vi.fn().mockRejectedValue(result)
        : vi.fn().mockResolvedValue(
            result ?? {
              requestedDate: '2026-04-18',
              effectiveDate: '2026-04-17',
              baseCurrency: 'EUR',
              quoteCurrency: 'NOK',
              rate: 11.017,
              provider: 'ECB',
              fetchedAt: '2026-04-19T09:00:00.000Z',
            },
          ),
  }
}
