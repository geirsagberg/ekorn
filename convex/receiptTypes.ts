import { v } from 'convex/values'

export const savedReceiptStatusValidator = v.union(
  v.literal('ready'),
  v.literal('needs-review'),
)

export const savedReceiptFxConversionValidator = v.union(
  v.object({
    sourceCurrency: v.string(),
    targetCurrency: v.string(),
    basisDate: v.string(),
    basisKind: v.union(
      v.literal('purchase_date'),
      v.literal('capture_date_fallback'),
    ),
    effectiveRateDate: v.union(v.string(), v.null()),
    rate: v.union(v.number(), v.null()),
    provider: v.literal('ECB'),
    convertedTotal: v.union(v.number(), v.null()),
    convertedSubtotal: v.union(v.number(), v.null()),
    conversionStatus: v.union(
      v.literal('exact'),
      v.literal('fallback_cached'),
      v.literal('unavailable'),
    ),
  }),
  v.null(),
)

export const receiptOcrPreviewResultValidator = v.object({
  items: v.array(
    v.object({
      text: v.string(),
      amount: v.union(v.number(), v.null()),
      categories: v.array(v.string()),
      categorizationConfidence: v.union(v.number(), v.null()),
      categorizationSource: v.union(
        v.literal('raw_cache'),
        v.literal('normalized_cache'),
        v.literal('ai_existing'),
        v.literal('ai_new'),
        v.null(),
      ),
      isLowConfidence: v.boolean(),
    }),
  ),
  merchantName: v.union(v.string(), v.null()),
  purchaseDate: v.union(v.string(), v.null()),
  subtotal: v.union(v.number(), v.null()),
  total: v.union(v.number(), v.null()),
  currency: v.union(v.string(), v.null()),
  sanityCheck: v.object({
    itemSum: v.union(v.number(), v.null()),
    compareTarget: v.union(
      v.literal('subtotal'),
      v.literal('total'),
      v.literal('none'),
    ),
    expected: v.union(v.number(), v.null()),
    delta: v.union(v.number(), v.null()),
    status: v.union(
      v.literal('ok'),
      v.literal('warning'),
      v.literal('unavailable'),
    ),
  }),
  rawWarnings: v.array(v.string()),
})
