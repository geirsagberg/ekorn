export function logReceiptDebug(
  scope: 'categorization' | 'ocr' | 'storage',
  details: Record<string, unknown>,
) {
  console.info(`[receipt-${scope}] ${JSON.stringify(details)}`)
}
