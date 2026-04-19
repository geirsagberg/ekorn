export const MAX_RECEIPT_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export type ReceiptOcrProviderName = 'openai'

export type ReceiptItemCategorizationSource =
  | 'raw_cache'
  | 'normalized_cache'
  | 'ai_existing'
  | 'ai_new'

export interface ReceiptOcrParsedItem {
  text: string
  amount: number | null
  confidence?: number
}

export interface ReceiptOcrPreviewItem {
  text: string
  amount: number | null
  categories: string[]
  categorizationConfidence: number | null
  categorizationSource: ReceiptItemCategorizationSource | null
  isLowConfidence: boolean
}

export interface ReceiptOcrParsedResult {
  items: ReceiptOcrParsedItem[]
  merchantName: string | null
  purchaseDate: string | null
  subtotal: number | null
  total: number | null
  currency: string | null
  rawWarnings: string[]
}

export interface ReceiptSanityCheck {
  itemSum: number | null
  compareTarget: 'subtotal' | 'total' | 'none'
  expected: number | null
  delta: number | null
  status: 'ok' | 'warning' | 'unavailable'
}

export interface ReceiptOcrPreviewResult {
  items: ReceiptOcrPreviewItem[]
  merchantName: string | null
  purchaseDate: string | null
  subtotal: number | null
  total: number | null
  currency: string | null
  sanityCheck: ReceiptSanityCheck
  rawWarnings: string[]
}

export interface ReceiptOcrProvider {
  providerName: ReceiptOcrProviderName
  analyzeReceipt(file: File): Promise<ReceiptOcrPreviewResult>
}

export interface ReceiptOcrParsedProvider {
  providerName: ReceiptOcrProviderName
  analyzeReceipt(file: File): Promise<ReceiptOcrParsedResult>
}

export function sanitizeReceiptOcrPreviewResult(
  analysis: ReceiptOcrPreviewResult,
): ReceiptOcrPreviewResult {
  return {
    items: analysis.items.map((item) => ({
      text: item.text,
      amount: item.amount,
      categories: [...item.categories],
      categorizationConfidence: item.categorizationConfidence,
      categorizationSource: item.categorizationSource,
      isLowConfidence: item.isLowConfidence,
    })),
    merchantName: analysis.merchantName,
    purchaseDate: analysis.purchaseDate,
    subtotal: analysis.subtotal,
    total: analysis.total,
    currency: analysis.currency,
    sanityCheck: {
      itemSum: analysis.sanityCheck.itemSum,
      compareTarget: analysis.sanityCheck.compareTarget,
      expected: analysis.sanityCheck.expected,
      delta: analysis.sanityCheck.delta,
      status: analysis.sanityCheck.status,
    },
    rawWarnings: [...analysis.rawWarnings],
  }
}
