import type {
  ReceiptOcrItem,
  ReceiptOcrPreviewResult,
  ReceiptSanityCheck,
} from './shared'

interface TextractValueDetection {
  Text?: string
  Confidence?: number
}

interface TextractCurrency {
  Code?: string
}

interface TextractType {
  Text?: string
  Confidence?: number
}

interface TextractExpenseField {
  Type?: TextractType
  ValueDetection?: TextractValueDetection
  Currency?: TextractCurrency
}

interface TextractLineItem {
  LineItemExpenseFields?: TextractExpenseField[]
}

interface TextractLineItemGroup {
  LineItems?: TextractLineItem[]
}

interface TextractExpenseDocument {
  LineItemGroups?: TextractLineItemGroup[]
  SummaryFields?: TextractExpenseField[]
}

export interface TextractExpenseAnalysis {
  ExpenseDocuments?: TextractExpenseDocument[]
}

const TEXT_FIELD_TYPES = ['ITEM', 'ITEM_NAME', 'DESCRIPTION']
const AMOUNT_FIELD_TYPES = ['PRICE', 'AMOUNT', 'ITEM_TOTAL']
const SUBTOTAL_FIELD_TYPES = ['SUBTOTAL']
const TOTAL_FIELD_TYPES = ['TOTAL', 'TOTAL_DUE', 'AMOUNT_DUE', 'BALANCE']

export function normalizeReceiptOcrResult(
  analysis: TextractExpenseAnalysis,
): ReceiptOcrPreviewResult {
  const expenseDocument = analysis.ExpenseDocuments?.[0]

  if (!expenseDocument) {
    return {
      items: [],
      subtotal: null,
      total: null,
      currency: null,
      sanityCheck: computeReceiptSanityCheck([], null, null),
      rawWarnings: ['No receipt fields were detected.'],
    }
  }

  const items = extractReceiptItems(expenseDocument.LineItemGroups ?? [])
  const { subtotal, total, currency } = extractReceiptSummary(
    expenseDocument.SummaryFields ?? [],
  )
  const sanityCheck = computeReceiptSanityCheck(items, subtotal, total)
  const rawWarnings: string[] = []

  if (items.some((item) => item.amount === null)) {
    rawWarnings.push('Some line items are missing amounts.')
  }

  if (sanityCheck.status === 'warning') {
    rawWarnings.push('Line item amounts do not match the receipt summary.')
  }

  return {
    items,
    subtotal,
    total,
    currency,
    sanityCheck,
    rawWarnings,
  }
}

export function computeReceiptSanityCheck(
  items: ReceiptOcrItem[],
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

function extractReceiptItems(lineItemGroups: TextractLineItemGroup[]) {
  return lineItemGroups.flatMap((lineItemGroup) =>
    (lineItemGroup.LineItems ?? [])
      .map((lineItem) => mapReceiptItem(lineItem.LineItemExpenseFields ?? []))
      .filter((item): item is ReceiptOcrItem => item !== null),
  )
}

function mapReceiptItem(fields: TextractExpenseField[]): ReceiptOcrItem | null {
  const textField =
    findFieldByTypes(fields, TEXT_FIELD_TYPES) ??
    fields.find((field) => {
      const valueText = normalizeText(field.ValueDetection?.Text)
      const fieldType = normalizeFieldType(field.Type?.Text)

      return (
        valueText !== null &&
        !AMOUNT_FIELD_TYPES.includes(fieldType) &&
        parseReceiptAmount(valueText) === null
      )
    }) ??
    fields.find((field) => normalizeText(field.ValueDetection?.Text) !== null)

  const amountField =
    findFieldByTypes(fields, AMOUNT_FIELD_TYPES) ??
    [...fields]
      .reverse()
      .find(
        (field) =>
          parseReceiptAmount(field.ValueDetection?.Text ?? null) !== null,
      )

  const text = normalizeText(textField?.ValueDetection?.Text)

  if (!text) {
    return null
  }

  const amount = parseReceiptAmount(amountField?.ValueDetection?.Text ?? null)
  const confidenceValues = [
    textField?.ValueDetection?.Confidence,
    amountField?.ValueDetection?.Confidence,
  ].filter((confidence): confidence is number => typeof confidence === 'number')
  const confidence =
    confidenceValues.length > 0
      ? roundConfidence(
          confidenceValues.reduce((sum, value) => sum + value, 0) /
            confidenceValues.length,
        )
      : undefined

  return {
    text,
    amount,
    confidence,
  }
}

function extractReceiptSummary(summaryFields: TextractExpenseField[]) {
  const subtotalField = findFieldByTypes(summaryFields, SUBTOTAL_FIELD_TYPES)
  const totalField = findFieldByTypes(summaryFields, TOTAL_FIELD_TYPES)
  const currency =
    subtotalField?.Currency?.Code ??
    totalField?.Currency?.Code ??
    summaryFields.find((field) => field.Currency?.Code)?.Currency?.Code ??
    null

  return {
    subtotal: parseReceiptAmount(subtotalField?.ValueDetection?.Text ?? null),
    total: parseReceiptAmount(totalField?.ValueDetection?.Text ?? null),
    currency,
  }
}

function findFieldByTypes(
  fields: TextractExpenseField[],
  expectedTypes: string[],
) {
  return fields.find((field) =>
    expectedTypes.includes(normalizeFieldType(field.Type?.Text)),
  )
}

function normalizeFieldType(value: string | undefined) {
  return value?.trim().toUpperCase() ?? ''
}

function normalizeText(value: string | undefined) {
  const text = value?.replace(/\s+/g, ' ').trim()

  return text ? text : null
}

function roundConfidence(value: number) {
  return Math.round(value * 10) / 10
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

export function parseReceiptAmount(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const sanitized = value.replace(/[^\d,.-]/g, '').trim()

  if (!sanitized) {
    return null
  }

  const lastCommaIndex = sanitized.lastIndexOf(',')
  const lastDotIndex = sanitized.lastIndexOf('.')
  let normalized = sanitized

  if (lastCommaIndex >= 0 && lastDotIndex >= 0) {
    const decimalSeparator = lastCommaIndex > lastDotIndex ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ','

    normalized = normalized.replaceAll(thousandsSeparator, '')
    normalized =
      decimalSeparator === ',' ? normalized.replace(',', '.') : normalized
  } else if (lastCommaIndex >= 0) {
    const fractionalDigits = sanitized.length - lastCommaIndex - 1
    normalized =
      fractionalDigits > 0 && fractionalDigits <= 2
        ? sanitized.replace(',', '.')
        : sanitized.replaceAll(',', '')
  } else if (lastDotIndex >= 0) {
    const parts = sanitized.split('.')

    if (parts.length > 2) {
      const decimal = parts.pop()
      normalized = `${parts.join('')}.${decimal}`
    }
  }

  const parsedAmount = Number.parseFloat(normalized)

  return Number.isFinite(parsedAmount) ? roundCurrency(parsedAmount) : null
}
