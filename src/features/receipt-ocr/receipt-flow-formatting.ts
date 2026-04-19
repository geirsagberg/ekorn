import type { SavedReceipt } from './saved-receipts'
import type { ReceiptOcrPreviewResult } from './shared'

export function buildDisplayItems(items: ReceiptOcrPreviewResult['items']) {
  const counts = new Map<string, number>()

  return items.map((item) => {
    const baseKey = `${item.text}-${item.amount ?? 'missing'}`
    const seenCount = counts.get(baseKey) ?? 0
    counts.set(baseKey, seenCount + 1)

    return {
      item,
      key: `${baseKey}-${seenCount + 1}`,
    }
  })
}

export function buildSanityWarning(result: ReceiptOcrPreviewResult) {
  const targetLabel =
    result.sanityCheck.compareTarget === 'subtotal' ? 'subtotal' : 'total'

  return `Check this receipt. Extracted items sum to ${formatMoney(
    result.sanityCheck.itemSum,
    result.currency,
  )}, while the ${targetLabel} is ${formatMoney(
    result.sanityCheck.expected,
    result.currency,
  )}.`
}

export function formatMoney(amount: number | null, currency: string | null) {
  if (amount === null) {
    return '—'
  }

  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      return `${amount.toFixed(2)} ${currency}`
    }
  }

  return amount.toFixed(2)
}

export function formatCaptureTime(createdAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt))
}

export function formatPurchaseDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(`${value}T00:00:00`))
}

export function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`
}

export function describeCategorizationSource(
  source: ReceiptOcrPreviewResult['items'][number]['categorizationSource'],
) {
  switch (source) {
    case 'raw_cache':
      return 'Stored categorization from an exact label match.'
    case 'normalized_cache':
      return 'Stored categorization from a normalized label match.'
    case 'ai_existing':
      return 'AI categorization mapped to an existing taxonomy path.'
    case 'ai_new':
      return 'AI categorization created a new taxonomy path.'
    default:
      return 'Categorization confidence details are unavailable.'
  }
}

export function getConfidenceTone(confidence: number) {
  if (confidence >= 0.9) {
    return {
      background: 'rgba(47, 125, 87, 0.12)',
      border: 'rgba(47, 125, 87, 0.32)',
      foreground: '#215740',
      hoverBackground: 'rgba(47, 125, 87, 0.2)',
    }
  }

  if (confidence >= 0.75) {
    return {
      background: 'rgba(176, 127, 42, 0.12)',
      border: 'rgba(176, 127, 42, 0.3)',
      foreground: '#8a6430',
      hoverBackground: 'rgba(176, 127, 42, 0.2)',
    }
  }

  return {
    background: 'rgba(181, 77, 48, 0.12)',
    border: 'rgba(181, 77, 48, 0.3)',
    foreground: '#9b452d',
    hoverBackground: 'rgba(181, 77, 48, 0.2)',
  }
}

export function hasReceiptImageSource(receipt: SavedReceipt) {
  return receipt.imageBlob !== null || receipt.imageUrl !== null
}

export function hasUsableFxConversion(receipt: SavedReceipt) {
  return (
    receipt.fxConversion !== null &&
    receipt.fxConversion.conversionStatus !== 'unavailable' &&
    receipt.fxConversion.convertedTotal !== null
  )
}

export function getPrimaryHistoryAmount(receipt: SavedReceipt) {
  if (hasUsableFxConversion(receipt)) {
    return formatMoney(
      receipt.fxConversion?.convertedTotal ?? null,
      receipt.fxConversion?.targetCurrency ?? null,
    )
  }

  return formatMoney(receipt.total, receipt.currency)
}

export function getSecondaryHistoryAmount(receipt: SavedReceipt) {
  if (!hasUsableFxConversion(receipt)) {
    return null
  }

  return formatMoney(receipt.total, receipt.currency)
}

export function buildOriginalTotalLabel(receipt: SavedReceipt) {
  return receipt.currency ? `Original total (${receipt.currency})` : 'Total'
}

export function buildFxConversionNote(receipt: SavedReceipt) {
  if (receipt.fxConversion === null) {
    return null
  }

  if (receipt.fxConversion.conversionStatus === 'unavailable') {
    return 'Historical conversion was unavailable, so this receipt is shown only in the original currency.'
  }

  const basisLabel =
    receipt.fxConversion.basisKind === 'purchase_date'
      ? `purchase date ${receipt.fxConversion.basisDate}`
      : `capture date ${receipt.fxConversion.basisDate} because the purchase date was missing`
  const prefix =
    receipt.fxConversion.conversionStatus === 'fallback_cached'
      ? 'Cached ECB rate'
      : 'ECB rate'

  return `${prefix} from ${receipt.fxConversion.effectiveRateDate} used for ${basisLabel}.`
}
