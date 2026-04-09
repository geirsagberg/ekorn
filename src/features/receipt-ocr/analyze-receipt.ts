import { createServerFn } from '@tanstack/react-start'
import { normalizeReceiptOcrResult } from './normalize'
import {
  MAX_RECEIPT_IMAGE_SIZE_BYTES,
  type ReceiptOcrPreviewResult,
} from './shared'

export const analyzeReceiptPreview = createServerFn({ method: 'POST' })
  .inputValidator((data: FormData) => data)
  .handler(async ({ data }): Promise<ReceiptOcrPreviewResult> => {
    const file = data.get('receiptImage')

    if (!(file instanceof File)) {
      throw new Error('Choose a receipt photo first.')
    }

    if (!file.type.startsWith('image/')) {
      throw new Error('Choose an image file from your camera or photo library.')
    }

    if (file.size > MAX_RECEIPT_IMAGE_SIZE_BYTES) {
      throw new Error('Choose an image smaller than 10 MB.')
    }

    const awsEnv = getAwsEnv()
    const region = awsEnv.region

    if (!region) {
      throw new Error('Receipt OCR is not configured yet.')
    }

    try {
      const { AnalyzeExpenseCommand, TextractClient } = await import(
        '@aws-sdk/client-textract'
      )
      const textractClient = new TextractClient({
        region,
        credentials:
          awsEnv.accessKeyId && awsEnv.secretAccessKey
            ? {
                accessKeyId: awsEnv.accessKeyId,
                secretAccessKey: awsEnv.secretAccessKey,
                sessionToken: awsEnv.sessionToken || undefined,
              }
            : undefined,
      })
      const imageBytes = new Uint8Array(await file.arrayBuffer())
      const analysis = await textractClient.send(
        new AnalyzeExpenseCommand({
          Document: { Bytes: imageBytes },
        }),
      )
      const result = normalizeReceiptOcrResult(analysis)

      if (result.items.length === 0) {
        throw new Error('No line items were detected. Try a clearer photo.')
      }

      return result
    } catch (error) {
      throw toReceiptOcrError(error)
    }
  })

function toReceiptOcrError(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message === 'Choose a receipt photo first.' ||
      error.message ===
        'Choose an image file from your camera or photo library.' ||
      error.message === 'Choose an image smaller than 10 MB.' ||
      error.message === 'Receipt OCR is not configured yet.' ||
      error.message === 'No line items were detected. Try a clearer photo.'
    ) {
      return error
    }

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

function getAwsEnv() {
  const env = import.meta.env as Record<string, string | undefined>

  return {
    region:
      env.AWS_REGION ??
      env.AWS_DEFAULT_REGION ??
      process.env.AWS_REGION ??
      process.env.AWS_DEFAULT_REGION ??
      null,
    accessKeyId: env.AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? null,
    secretAccessKey:
      env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? null,
    sessionToken:
      env.AWS_SESSION_TOKEN ?? process.env.AWS_SESSION_TOKEN ?? null,
  }
}
