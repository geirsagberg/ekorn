import type { FxRateLookupInput, FxRateRecord } from './shared'

export interface FxRateProvider {
  getRate(input: FxRateLookupInput): Promise<FxRateRecord>
}
