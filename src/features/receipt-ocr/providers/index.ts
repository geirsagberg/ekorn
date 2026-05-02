import { buildReceiptOcrPreviewResult } from '../normalize'
import type {
  ReceiptOcrParsedProvider,
  ReceiptOcrParsedResult,
  ReceiptOcrProvider,
  ReceiptOcrProviderName,
} from '../shared'
import { ReceiptImageRotationRequiredError } from '../shared'
import { createOpenAiReceiptProvider } from './openai'

export function createReceiptOcrProvider(
  providerName: ReceiptOcrProviderName = getReceiptOcrProviderName(),
): ReceiptOcrProvider {
  const parsedProvider = createParsedReceiptOcrProvider(providerName)

  return {
    providerName: parsedProvider.providerName,
    analyzeReceipt: async (file) => {
      let parsedResult: ReceiptOcrParsedResult

      try {
        parsedResult = await parsedProvider.analyzeReceipt(file)
      } catch (error) {
        if (error instanceof ReceiptImageRotationRequiredError) {
          return {
            kind: 'rotation_required',
            rotationDegrees: error.rotationDegrees,
            message: error.message,
          }
        }

        throw error
      }

      const previewResult = buildReceiptOcrPreviewResult(parsedResult)

      if (previewResult.items.length === 0) {
        throw new Error('No line items were detected. Try a clearer photo.')
      }

      return {
        kind: 'parsed',
        analysis: previewResult,
      }
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
  const providerName = normalizeProviderName(
    readEnvironmentValue('OCR_PROVIDER'),
  )

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

function normalizeProviderName(value: string | undefined) {
  const normalized =
    value
      ?.trim()
      .replace(/^['"]+|['"]+$/g, '')
      .trim()
      .toLowerCase() ?? ''

  return normalized.length > 0 ? normalized : null
}
