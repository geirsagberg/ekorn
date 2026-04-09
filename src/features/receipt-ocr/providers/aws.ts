import { AnalyzeExpenseCommand, TextractClient } from '@aws-sdk/client-textract'
import type { ReceiptOcrParsedProvider } from '../shared'
import { normalizeAwsTextractReceipt } from './aws-textract-normalize'

export function createAwsReceiptOcrProvider(
  config: AwsReceiptOcrConfig = getAwsReceiptOcrConfig(),
): ReceiptOcrParsedProvider {
  const region = config.region

  if (!region) {
    throw new Error('Receipt OCR is not configured yet.')
  }

  return {
    providerName: 'aws',
    analyzeReceipt: async (file) => {
      try {
        const imageBytes = new Uint8Array(await file.arrayBuffer())
        const textractClient = new TextractClient({
          region,
          credentials:
            config.accessKeyId && config.secretAccessKey
              ? {
                  accessKeyId: config.accessKeyId,
                  secretAccessKey: config.secretAccessKey,
                  sessionToken: config.sessionToken || undefined,
                }
              : undefined,
        })
        const analysis = await textractClient.send(
          new AnalyzeExpenseCommand({
            Document: { Bytes: imageBytes },
          }),
        )

        return normalizeAwsTextractReceipt(analysis)
      } catch (error) {
        throw toAwsReceiptOcrError(error)
      }
    },
  }
}

function toAwsReceiptOcrError(error: unknown) {
  if (error instanceof Error) {
    const errorName = 'name' in error ? String(error.name) : ''

    if (
      errorName === 'UnsupportedDocumentException' ||
      errorName === 'BadDocumentException'
    ) {
      return new Error('This photo could not be read as a receipt.')
    }

    if (errorName === 'DocumentTooLargeException') {
      return new Error('Choose an image smaller than 10 MB.')
    }

    if (
      errorName === 'ProvisionedThroughputExceededException' ||
      errorName === 'ThrottlingException'
    ) {
      return new Error('Receipt OCR is busy right now. Try again in a moment.')
    }
  }

  return new Error('Receipt OCR failed. Try another photo.')
}

interface AwsReceiptOcrConfig {
  region: string | null
  accessKeyId: string | null
  secretAccessKey: string | null
  sessionToken: string | null
}

function getAwsReceiptOcrConfig(): AwsReceiptOcrConfig {
  return {
    region:
      readEnvironmentValue('AWS_REGION') ??
      readEnvironmentValue('AWS_DEFAULT_REGION') ??
      null,
    accessKeyId: readEnvironmentValue('AWS_ACCESS_KEY_ID') ?? null,
    secretAccessKey: readEnvironmentValue('AWS_SECRET_ACCESS_KEY') ?? null,
    sessionToken: readEnvironmentValue('AWS_SESSION_TOKEN') ?? null,
  }
}

function readEnvironmentValue(name: string) {
  const viteEnv = import.meta.env as Record<string, string | undefined>

  return process.env[name] ?? viteEnv[name]
}
