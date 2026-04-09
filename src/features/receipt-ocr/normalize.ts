import type {
  ReceiptOcrParsedResult,
  ReceiptOcrPreviewResult,
  ReceiptSanityCheck,
} from './shared'

export function computeReceiptSanityCheck(
  items: ReceiptOcrParsedResult['items'],
  subtotal: number | null,
  total: number | null,
): ReceiptSanityCheck {
  const numericAmounts = items
    .map((item) => item.amount)
    .filter((amount): amount is number => amount !== null)
  const itemSum =
    numericAmounts.length > 0
      ? roundCurrency(
          numericAmounts.reduce(
            (runningTotal, amount) => runningTotal + amount,
            0,
          ),
        )
      : null
  const compareTarget =
    subtotal !== null ? 'subtotal' : total !== null ? 'total' : 'none'
  const expected =
    compareTarget === 'subtotal'
      ? subtotal
      : compareTarget === 'total'
        ? total
        : null

  if (itemSum === null || expected === null) {
    return {
      itemSum,
      compareTarget,
      expected,
      delta: null,
      status: 'unavailable',
    }
  }

  const delta = roundCurrency(itemSum - expected)

  return {
    itemSum,
    compareTarget,
    expected,
    delta,
    status: Math.abs(delta) <= 0.05 ? 'ok' : 'warning',
  }
}

export function buildReceiptOcrPreviewResult(
  parsedResult: ReceiptOcrParsedResult,
): ReceiptOcrPreviewResult {
  const sanityCheck = computeReceiptSanityCheck(
    parsedResult.items,
    parsedResult.subtotal,
    parsedResult.total,
  )
  const rawWarnings = new Set(parsedResult.rawWarnings)

  if (parsedResult.items.some((item) => item.amount === null)) {
    rawWarnings.add('Some line items are missing amounts.')
  }

  if (sanityCheck.status === 'warning') {
    rawWarnings.add('Line item amounts do not match the receipt summary.')
  }

  return {
    ...parsedResult,
    sanityCheck,
    rawWarnings: [...rawWarnings],
  }
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}
