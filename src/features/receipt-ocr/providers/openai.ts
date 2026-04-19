import OpenAI from 'openai'
import type { Response } from 'openai/resources/responses/responses'
import { logReceiptDebug } from '../debug'
import type { ReceiptOcrParsedProvider } from '../shared'

const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini'

const OPENAI_RECEIPT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'items',
    'merchantName',
    'purchaseDate',
    'subtotal',
    'total',
    'currency',
    'rawWarnings',
  ],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'amount', 'confidence'],
        properties: {
          text: { type: 'string' },
          amount: { type: ['number', 'null'] },
          confidence: { type: ['number', 'null'] },
        },
      },
    },
    merchantName: { type: ['string', 'null'] },
    purchaseDate: { type: ['string', 'null'] },
    subtotal: { type: ['number', 'null'] },
    total: { type: ['number', 'null'] },
    currency: { type: ['string', 'null'] },
    rawWarnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const

export interface OpenAiReceiptParseResult {
  items: Array<{
    text: string
    amount: number | null
    confidence: number | null
  }>
  merchantName: string | null
  purchaseDate: string | null
  subtotal: number | null
  total: number | null
  currency: string | null
  rawWarnings: string[]
}

export function createOpenAiReceiptProvider(
  config: OpenAiReceiptOcrConfig = getOpenAiReceiptOcrConfig(),
): ReceiptOcrParsedProvider {
  if (!config.apiKey) {
    throw new Error('Receipt OCR is not configured yet.')
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
  })
  const model = config.model || DEFAULT_OPENAI_MODEL

  return {
    providerName: 'openai',
    analyzeReceipt: async (file) => {
      try {
        const base64Image = Buffer.from(await file.arrayBuffer()).toString(
          'base64',
        )
        const response = await client.responses.create({
          model,
          instructions: [
            'You extract structured grocery receipt data from a single receipt image.',
            'Return only purchasable line items in items.',
            'Do not include subtotal, tax, discount, tip, or total rows in items.',
            'Extract merchantName when you can infer the store or merchant confidently from the receipt header, otherwise return null.',
            'Extract purchaseDate in YYYY-MM-DD form when you can infer the transaction date confidently, otherwise return null.',
            'If an amount is not legible for an item, return null for that amount.',
            'Extract subtotal and total when present.',
            'Set currency to an ISO 4217 code when you can infer it confidently, otherwise null.',
            'Use rawWarnings for notable extraction uncertainty only.',
          ].join(' '),
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: 'Parse this receipt image into the required receipt OCR JSON schema.',
                },
                {
                  type: 'input_image',
                  image_url: `data:${file.type};base64,${base64Image}`,
                  detail: 'high',
                },
              ],
            },
          ],
          max_output_tokens: 1200,
          store: false,
          temperature: 0,
          text: {
            format: {
              type: 'json_schema',
              name: 'receipt_ocr_preview',
              strict: true,
              schema: OPENAI_RECEIPT_JSON_SCHEMA,
            },
          },
        })
        const parsed = parseOpenAiReceiptResult(response)

        logReceiptDebug('ocr', {
          event: 'openai_receipt_parsed',
          itemCount: parsed.items.length,
          merchantName: parsed.merchantName,
          rawWarningCount: parsed.rawWarnings.length,
        })

        return {
          items: parsed.items.map((item) => ({
            text: item.text,
            amount: item.amount,
            confidence: item.confidence ?? undefined,
          })),
          merchantName: parsed.merchantName,
          purchaseDate: parsed.purchaseDate,
          subtotal: parsed.subtotal,
          total: parsed.total,
          currency: parsed.currency,
          rawWarnings: parsed.rawWarnings,
        }
      } catch (error) {
        throw toOpenAiReceiptOcrError(error)
      }
    },
  }
}

export function normalizeOpenAiReceiptParseResult(
  value: unknown,
): OpenAiReceiptParseResult {
  if (!isRecord(value)) {
    throw new Error('Receipt OCR failed. Try another photo.')
  }

  const items = value.items
  const rawWarnings = value.rawWarnings

  if (!Array.isArray(items) || !Array.isArray(rawWarnings)) {
    throw new Error('Receipt OCR failed. Try another photo.')
  }

  return {
    items: items
      .map((item) => {
        if (!isRecord(item) || typeof item.text !== 'string') {
          throw new Error('Receipt OCR failed. Try another photo.')
        }

        return {
          text: item.text.trim(),
          amount: parseOptionalNumber(item.amount),
          confidence: parseOptionalNumber(item.confidence),
        }
      })
      .filter((item) => item.text.length > 0),
    merchantName:
      typeof value.merchantName === 'string' &&
      value.merchantName.trim().length > 0
        ? value.merchantName.trim()
        : null,
    purchaseDate:
      typeof value.purchaseDate === 'string' &&
      isValidPurchaseDate(value.purchaseDate.trim())
        ? value.purchaseDate.trim()
        : null,
    subtotal: parseOptionalNumber(value.subtotal),
    total: parseOptionalNumber(value.total),
    currency:
      typeof value.currency === 'string' && value.currency.trim().length > 0
        ? value.currency.trim().toUpperCase()
        : null,
    rawWarnings: rawWarnings.filter(
      (warning): warning is string => typeof warning === 'string',
    ),
  }
}

export interface OpenAiReceiptOcrConfig {
  apiKey: string | null
  model: string | null
}

function parseOpenAiReceiptResult(response: Response) {
  const refusal = extractOpenAiRefusal(response)

  if (refusal) {
    throw new Error('This photo could not be read as a receipt.')
  }

  if (!response.output_text) {
    throw new Error('Receipt OCR failed. Try another photo.')
  }

  return normalizeOpenAiReceiptParseResult(JSON.parse(response.output_text))
}

function extractOpenAiRefusal(response: Response) {
  for (const outputItem of response.output ?? []) {
    if (outputItem.type !== 'message') {
      continue
    }

    for (const contentItem of outputItem.content ?? []) {
      if (contentItem.type === 'refusal' && contentItem.refusal) {
        return contentItem.refusal
      }
    }
  }

  return null
}

function toOpenAiReceiptOcrError(error: unknown) {
  if (error instanceof Error) {
    const errorStatus =
      'status' in error && typeof error.status === 'number'
        ? error.status
        : null

    if (
      error.message === 'Receipt OCR is not configured yet.' ||
      error.message === 'This photo could not be read as a receipt.' ||
      error.message === 'Receipt OCR failed. Try another photo.'
    ) {
      return error
    }

    if (errorStatus === 401 || errorStatus === 403) {
      return new Error('Receipt OCR is not configured yet.')
    }

    if (errorStatus === 429) {
      return new Error('Receipt OCR is busy right now. Try again in a moment.')
    }

    if (errorStatus === 400) {
      return new Error('This photo could not be read as a receipt.')
    }
  }

  return new Error('Receipt OCR failed. Try another photo.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isValidPurchaseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  return parsed.toISOString().slice(0, 10) === value
}

function getOpenAiReceiptOcrConfig(): OpenAiReceiptOcrConfig {
  return {
    apiKey: readEnvironmentValue('OPENAI_API_KEY') ?? null,
    model: readEnvironmentValue('OPENAI_MODEL') ?? null,
  }
}

function readEnvironmentValue(name: string) {
  const viteEnv = import.meta.env as Record<string, string | undefined>

  return process.env[name] ?? viteEnv[name]
}
