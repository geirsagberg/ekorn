import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const responsesCreateMock = vi.fn()

vi.mock('openai', () => {
  const OpenAIMock = vi.fn(function OpenAI() {
    return {
      responses: {
        create: responsesCreateMock,
      },
    }
  })

  return {
    default: OpenAIMock,
  }
})

import {
  createOpenAiReceiptProvider,
  normalizeOpenAiReceiptParseResult,
} from './openai'

describe('OpenAI receipt OCR provider', () => {
  beforeEach(() => {
    responsesCreateMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('maps a valid parsed receipt into the shared OCR shape', async () => {
    responsesCreateMock.mockResolvedValue({
      output: [{ type: 'message', content: [] }],
      output_text: JSON.stringify({
        items: [
          { text: 'Milk', amount: 2.5, confidence: 0.97 },
          { text: 'Bread', amount: 4.5, confidence: 0.94 },
        ],
        subtotal: 7,
        total: 8.25,
        currency: 'usd',
        rawWarnings: [],
      }),
    })

    const provider = createOpenAiReceiptProvider({
      apiKey: 'test-openai-key',
      model: 'gpt-4.1-mini',
    })
    const result = await provider.analyzeReceipt(
      new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
    )

    expect(result).toEqual({
      items: [
        { text: 'Milk', amount: 2.5, confidence: 0.97 },
        { text: 'Bread', amount: 4.5, confidence: 0.94 },
      ],
      subtotal: 7,
      total: 8.25,
      currency: 'USD',
      rawWarnings: [],
    })
  })

  it('keeps empty item lists and missing subtotal values when the model returns them', async () => {
    responsesCreateMock.mockResolvedValue({
      output: [{ type: 'message', content: [] }],
      output_text: JSON.stringify({
        items: [],
        subtotal: null,
        total: 12.4,
        currency: null,
        rawWarnings: ['Total was inferred from the receipt footer.'],
      }),
    })

    const provider = createOpenAiReceiptProvider({
      apiKey: 'test-openai-key',
      model: null,
    })
    const result = await provider.analyzeReceipt(
      new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
    )

    expect(result).toEqual({
      items: [],
      subtotal: null,
      total: 12.4,
      currency: null,
      rawWarnings: ['Total was inferred from the receipt footer.'],
    })
  })

  it('maps refusals to a user-safe unreadable-receipt error', async () => {
    responsesCreateMock.mockResolvedValue({
      output: [
        {
          type: 'message',
          content: [{ type: 'refusal', refusal: 'Cannot comply.' }],
        },
      ],
      output_text: '',
    })

    const provider = createOpenAiReceiptProvider({
      apiKey: 'test-openai-key',
      model: null,
    })

    await expect(
      provider.analyzeReceipt(
        new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).rejects.toThrow('This photo could not be read as a receipt.')
  })

  it('maps malformed output and provider failures to user-safe errors', async () => {
    const provider = createOpenAiReceiptProvider({
      apiKey: 'test-openai-key',
      model: null,
    })

    responsesCreateMock.mockResolvedValueOnce({
      output: [{ type: 'message', content: [] }],
      output_text: '{not-json',
    })

    await expect(
      provider.analyzeReceipt(
        new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).rejects.toThrow('Receipt OCR failed. Try another photo.')

    responsesCreateMock.mockRejectedValueOnce(
      Object.assign(new Error('rate limited'), { status: 429 }),
    )

    await expect(
      provider.analyzeReceipt(
        new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).rejects.toThrow('Receipt OCR is busy right now. Try again in a moment.')
  })

  it('normalizes structured output by dropping blank rows', () => {
    expect(
      normalizeOpenAiReceiptParseResult({
        items: [
          { text: '  Milk  ', amount: 2.5, confidence: 0.97 },
          { text: '   ', amount: 1.5, confidence: 0.5 },
        ],
        subtotal: 2.5,
        total: 2.5,
        currency: 'nok',
        rawWarnings: [],
      }),
    ).toEqual({
      items: [{ text: 'Milk', amount: 2.5, confidence: 0.97 }],
      subtotal: 2.5,
      total: 2.5,
      currency: 'NOK',
      rawWarnings: [],
    })
  })
})
