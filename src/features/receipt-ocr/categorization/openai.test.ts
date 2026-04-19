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

import { createOpenAiReceiptCategorizer } from './openai'

describe('OpenAI receipt categorizer', () => {
  beforeEach(() => {
    responsesCreateMock.mockReset()
    responsesCreateMock.mockResolvedValue({
      output: [{ type: 'message', content: [] }],
      output_text: JSON.stringify({
        items: [
          {
            itemIndex: 0,
            normalizedLabel: 'whole milk',
            categories: ['Food', 'Dairy'],
            confidence: 0.91,
            matchType: 'existing',
          },
        ],
      }),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_MODEL
    delete process.env.OPENAI_CATEGORIZATION_MODEL
  })

  it('falls back to OPENAI_MODEL when no categorization model override is set', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.OPENAI_MODEL = 'gpt-4.1-mini'

    const categorizer = createOpenAiReceiptCategorizer()

    await categorizer.categorizeItems({
      items: [
        {
          rawLabel: 'Milk 1L',
          normalizedCandidate: 'milk 1l',
          amount: 2.5,
          currency: 'NOK',
        },
      ],
      taxonomyPaths: [['Food', 'Dairy']],
    })

    expect(responsesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4.1-mini',
      }),
    )
  })

  it('prefers OPENAI_CATEGORIZATION_MODEL over OPENAI_MODEL when both are set', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.OPENAI_MODEL = 'gpt-4.1-mini'
    process.env.OPENAI_CATEGORIZATION_MODEL = 'gpt-5.4-mini'

    const categorizer = createOpenAiReceiptCategorizer()

    await categorizer.categorizeItems({
      items: [
        {
          rawLabel: 'Milk 1L',
          normalizedCandidate: 'milk 1l',
          amount: 2.5,
          currency: 'NOK',
        },
      ],
      taxonomyPaths: [['Food', 'Dairy']],
    })

    expect(responsesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
      }),
    )
  })
})
