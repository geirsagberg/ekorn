import { buildReceiptOcrPreviewResult } from '../normalize'
import type {
  ReceiptOcrParsedProvider,
  ReceiptOcrProvider,
  ReceiptOcrProviderName,
} from '../shared'
import { createOpenAiReceiptProvider } from './openai'

export function createReceiptOcrProvider(
  providerName: ReceiptOcrProviderName = getReceiptOcrProviderName(),
): ReceiptOcrProvider {
  const parsedProvider = createParsedReceiptOcrProvider(providerName)

  return {
    providerName: parsedProvider.providerName,
    analyzeReceipt: async (file) => {
      const parsedResult = await parsedProvider.analyzeReceipt(file)
      const previewResult = buildReceiptOcrPreviewResult(parsedResult)

      if (previewResult.items.length === 0) {
        throw new Error('No line items were detected. Try a clearer photo.')
      }

      return previewResult
    },
  }
}

export function createParsedReceiptOcrProvider(
  providerName: ReceiptOcrProviderName = getReceiptOcrProviderName(),
): ReceiptOcrParsedProvider {
  switch (providerName) {
    case 'openai':
      return createOpenAiReceiptProvider()
    default:
      throw new Error('Receipt OCR provider is not supported.')
  }
}

export function getReceiptOcrProviderName(): ReceiptOcrProviderName {
  const providerName = readEnvironmentValue('OCR_PROVIDER')

  if (!providerName) {
    return 'openai'
  }

  if (providerName === 'openai') {
    return providerName
  }

  throw new Error('Receipt OCR provider is not supported.')
}

function readEnvironmentValue(name: string) {
  const viteEnv = import.meta.env as Record<string, string | undefined>

  return process.env[name] ?? viteEnv[name]
}
