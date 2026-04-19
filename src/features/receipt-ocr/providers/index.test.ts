import { afterEach, describe, expect, it, vi } from 'vitest'

const { createOpenAiReceiptProviderMock } = vi.hoisted(() => ({
  createOpenAiReceiptProviderMock: vi.fn(() => ({
    providerName: 'openai' as const,
    analyzeReceipt: vi.fn(),
  })),
}))

vi.mock('./openai', () => ({
  createOpenAiReceiptProvider: createOpenAiReceiptProviderMock,
}))

import {
  createParsedReceiptOcrProvider,
  getReceiptOcrProviderName,
} from './index'

describe('receipt OCR provider selection', () => {
  afterEach(() => {
    createOpenAiReceiptProviderMock.mockClear()
    delete process.env.OCR_PROVIDER
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_MODEL
  })

  it('defaults to OpenAI when no provider is configured', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key'

    expect(getReceiptOcrProviderName()).toBe('openai')
    expect(createParsedReceiptOcrProvider().providerName).toBe('openai')
    expect(createOpenAiReceiptProviderMock).toHaveBeenCalledTimes(1)
  })

  it('throws a clean error for an unsupported provider', () => {
    process.env.OCR_PROVIDER = 'aws'

    expect(() => getReceiptOcrProviderName()).toThrow(
      'Receipt OCR provider is not supported.',
    )
  })

  it('throws a clean error when the selected provider is not configured', () => {
    delete process.env.OPENAI_API_KEY
    createOpenAiReceiptProviderMock.mockImplementationOnce(() => {
      throw new Error('Receipt OCR is not configured yet.')
    })

    expect(() => createParsedReceiptOcrProvider()).toThrow(
      'Receipt OCR is not configured yet.',
    )
  })
})
