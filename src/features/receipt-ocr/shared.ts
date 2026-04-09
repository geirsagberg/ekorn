export const MAX_RECEIPT_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export interface ReceiptOcrItem {
  text: string
  amount: number | null
  confidence?: number
}

export interface ReceiptSanityCheck {
  itemSum: number | null
  compareTarget: 'subtotal' | 'total' | 'none'
  expected: number | null
  delta: number | null
  status: 'ok' | 'warning' | 'unavailable'
}

export interface ReceiptOcrPreviewResult {
  items: ReceiptOcrItem[]
  subtotal: number | null
  total: number | null
  currency: string | null
  sanityCheck: ReceiptSanityCheck
  rawWarnings: string[]
}
