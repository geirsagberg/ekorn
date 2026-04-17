import OpenAI from 'openai'
import type { Response } from 'openai/resources/responses/responses'
import type { CategorizationAi, CategorizationAiSuggestion } from './service'
import { normalizeCategoryName, normalizeReceiptLabel } from './text'

const DEFAULT_OPENAI_CATEGORIZATION_MODEL = 'gpt-5.4-mini'

const OPENAI_CATEGORIZATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'itemIndex',
          'normalizedLabel',
          'categories',
          'confidence',
          'matchType',
        ],
        properties: {
          itemIndex: { type: 'integer' },
          normalizedLabel: { type: 'string' },
          categories: {
            type: 'array',
            items: { type: 'string' },
          },
          confidence: { type: 'number' },
          matchType: {
            type: 'string',
            enum: ['existing', 'new'],
          },
        },
      },
    },
  },
} as const

interface OpenAiCategorizationConfig {
  apiKey: string | null
  model: string | null
}

interface ParsedOpenAiCategorizationResult {
  items: Array<{
    itemIndex: number
    normalizedLabel: string
    categories: string[]
    confidence: number
    matchType: 'existing' | 'new'
  }>
}

export function createOpenAiReceiptCategorizer(
  config: OpenAiCategorizationConfig = getOpenAiCategorizationConfig(),
): CategorizationAi {
  if (!config.apiKey) {
    return {
      categorizeItems: async () => [],
    }
  }

  const client = new OpenAI({ apiKey: config.apiKey })
  const model = config.model || DEFAULT_OPENAI_CATEGORIZATION_MODEL

  return {
    categorizeItems: async ({ items, taxonomyPaths }) => {
      if (items.length === 0) {
        return []
      }

      try {
        const response = await client.responses.create({
          model,
          instructions: [
            'You categorize grocery receipt line items into an English category taxonomy.',
            'Reuse an existing taxonomy path whenever it is a reasonable fit.',
            'Only return a new path when the existing taxonomy clearly lacks the needed concept.',
            'Return category paths from root to leaf.',
            'Use normalizedLabel for a reusable canonical item name.',
            'Confidence must be between 0 and 1.',
            'If you are unsure, lower the confidence rather than inventing certainty.',
          ].join(' '),
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: [
                    'Existing taxonomy paths:',
                    JSON.stringify(taxonomyPaths),
                    'Receipt items to categorize:',
                    JSON.stringify(
                      items.map((item, itemIndex) => ({
                        itemIndex,
                        rawLabel: item.rawLabel,
                        amount: item.amount,
                        currency: item.currency,
                        normalizedCandidate: item.normalizedCandidate,
                      })),
                    ),
                  ].join('\n'),
                },
              ],
            },
          ],
          max_output_tokens: 1500,
          store: false,
          temperature: 0,
          text: {
            format: {
              type: 'json_schema',
              name: 'receipt_line_categorization',
              strict: true,
              schema: OPENAI_CATEGORIZATION_JSON_SCHEMA,
            },
          },
        })

        const parsed = parseOpenAiCategorizationResult(response)

        return parsed.items.flatMap((item) => {
          const normalizedLabel = normalizeReceiptLabel(item.normalizedLabel)
          const categories = item.categories
            .map((category) => normalizeCategoryName(category))
            .filter((category) => category.length > 0)
          const confidence = clampConfidence(item.confidence)

          if (normalizedLabel.length === 0 || categories.length === 0) {
            return []
          }

          return [
            {
              itemIndex: item.itemIndex,
              normalizedLabel,
              categories,
              confidence,
              source: item.matchType === 'new' ? 'ai_new' : 'ai_existing',
            } satisfies CategorizationAiSuggestion,
          ]
        })
      } catch {
        return []
      }
    },
  }
}

function parseOpenAiCategorizationResult(
  response: Response,
): ParsedOpenAiCategorizationResult {
  const refusal = extractOpenAiRefusal(response)

  if (refusal || !response.output_text) {
    throw new Error('Receipt categorization failed.')
  }

  return normalizeParsedOpenAiCategorizationResult(
    JSON.parse(response.output_text),
  )
}

function normalizeParsedOpenAiCategorizationResult(
  value: unknown,
): ParsedOpenAiCategorizationResult {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('Receipt categorization failed.')
  }

  return {
    items: value.items.flatMap((item) => {
      if (!isRecord(item)) {
        return []
      }

      if (
        typeof item.itemIndex !== 'number' ||
        typeof item.normalizedLabel !== 'string' ||
        !Array.isArray(item.categories) ||
        typeof item.confidence !== 'number' ||
        (item.matchType !== 'existing' && item.matchType !== 'new')
      ) {
        return []
      }

      return [
        {
          itemIndex: Math.trunc(item.itemIndex),
          normalizedLabel: item.normalizedLabel,
          categories: item.categories.filter(
            (category): category is string => typeof category === 'string',
          ),
          confidence: item.confidence,
          matchType: item.matchType,
        },
      ]
    }),
  }
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

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getOpenAiCategorizationConfig(): OpenAiCategorizationConfig {
  return {
    apiKey: readEnvironmentValue('OPENAI_API_KEY') ?? null,
    model: readEnvironmentValue('OPENAI_CATEGORIZATION_MODEL') ?? null,
  }
}

function readEnvironmentValue(name: string) {
  const viteEnv = import.meta.env as Record<string, string | undefined>

  return process.env[name] ?? viteEnv[name]
}
