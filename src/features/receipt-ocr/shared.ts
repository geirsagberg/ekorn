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

export interface ReceiptOcrPreviewItem extends ReceiptOcrParsedItem {
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
