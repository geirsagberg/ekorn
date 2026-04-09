import { afterEach, describe, expect, it, vi } from 'vitest'

const { createOpenAiReceiptProviderMock, createAwsReceiptOcrProviderMock } =
  vi.hoisted(() => ({
    createOpenAiReceiptProviderMock: vi.fn(() => ({
      providerName: 'openai' as const,
      analyzeReceipt: vi.fn(),
    })),
    createAwsReceiptOcrProviderMock: vi.fn(() => ({
      providerName: 'aws' as const,
      analyzeReceipt: vi.fn(),
    })),
  }))

vi.mock('./openai', () => ({
  createOpenAiReceiptProvider: createOpenAiReceiptProviderMock,
}))

vi.mock('./aws', () => ({
  createAwsReceiptOcrProvider: createAwsReceiptOcrProviderMock,
}))

import {
  createParsedReceiptOcrProvider,
  getReceiptOcrProviderName,
} from './index'

describe('receipt OCR provider selection', () => {
  afterEach(() => {
    createOpenAiReceiptProviderMock.mockClear()
    createAwsReceiptOcrProviderMock.mockClear()
    delete process.env.OCR_PROVIDER
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_MODEL
    delete process.env.AWS_REGION
    delete process.env.AWS_DEFAULT_REGION
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    delete process.env.AWS_SESSION_TOKEN
  })

  it('defaults to OpenAI when no provider is configured', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key'

    expect(getReceiptOcrProviderName()).toBe('openai')
    expect(createParsedReceiptOcrProvider().providerName).toBe('openai')
    expect(createOpenAiReceiptProviderMock).toHaveBeenCalledTimes(1)
  })

  it('selects AWS when configured', () => {
    process.env.OCR_PROVIDER = 'aws'
    process.env.AWS_REGION = 'eu-central-1'

    expect(getReceiptOcrProviderName()).toBe('aws')
    expect(createParsedReceiptOcrProvider().providerName).toBe('aws')
    expect(createAwsReceiptOcrProviderMock).toHaveBeenCalledTimes(1)
  })

  it('throws a clean error for an unsupported provider', () => {
    process.env.OCR_PROVIDER = 'azure'

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
