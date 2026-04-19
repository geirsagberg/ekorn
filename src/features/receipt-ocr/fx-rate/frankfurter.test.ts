import { describe, expect, it, vi } from 'vitest'
import {
  createFrankfurterEcbFxRateProvider,
  parseFrankfurterEcbRateResponse,
} from './frankfurter'

describe('parseFrankfurterEcbRateResponse', () => {
  it('parses the effective date and rate returned by Frankfurter', () => {
    expect(
      parseFrankfurterEcbRateResponse([
        {
          date: '2026-04-17',
          rate: 11.017,
        },
      ]),
    ).toEqual({
      effectiveDate: '2026-04-17',
      rate: 11.017,
    })
  })

  it('rejects malformed responses', () => {
    expect(() => parseFrankfurterEcbRateResponse([])).toThrow(
      'Could not fetch a historical exchange rate.',
    )
  })
})

describe('createFrankfurterEcbFxRateProvider', () => {
  it('requests ECB-backed historical rates and trusts the effective rate date', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          date: '2026-04-17',
          rate: 11.017,
        },
      ],
    })
    const provider = createFrankfurterEcbFxRateProvider({ fetch: fetchMock })

    const result = await provider.getRate({
      baseCurrency: 'EUR',
      quoteCurrency: 'NOK',
      requestedDate: '2026-04-18',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v2/rates?date=2026-04-18&base=EUR&quotes=NOK&providers=ECB',
    )
    expect(result.requestedDate).toBe('2026-04-18')
    expect(result.effectiveDate).toBe('2026-04-17')
    expect(result.rate).toBe(11.017)
    expect(result.provider).toBe('ECB')
  })
})
