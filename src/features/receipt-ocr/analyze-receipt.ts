import { createServerFn } from '@tanstack/react-start'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import {
  isAllowedUserEmail,
  parseAllowedUserEmails,
} from '#/integrations/auth/access-control'
import { categorizeReceiptPreviewResult } from './categorization'
import { logReceiptDebug } from './debug'
import { createReceiptOcrProvider } from './providers'
import {
  MAX_RECEIPT_IMAGE_SIZE_BYTES,
  type ReceiptOcrPreviewResult,
} from './shared'

export const analyzeReceiptPreview = createServerFn({ method: 'POST' })
  .inputValidator((data: FormData) => data)
  .handler(async ({ data }): Promise<ReceiptOcrPreviewResult> => {
    const { user } = await getAuth()

    if (!user) {
      throw new Error('Sign in before processing receipts.')
    }

    const allowedEmails = parseAllowedUserEmails(
      process.env.ALLOWED_USER_EMAILS,
    )

    if (!isAllowedUserEmail(user.email ?? null, allowedEmails)) {
      throw new Error('This account is not allowed to process receipts.')
    }

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

    try {
      const provider = createReceiptOcrProvider()
      const previewResult = await provider.analyzeReceipt(file)

      logReceiptDebug('ocr', {
        event: 'receipt_preview_built',
        merchantName: previewResult.merchantName,
        providerName: provider.providerName,
      })

      try {
        const categorizedResult =
          await categorizeReceiptPreviewResult(previewResult)

        logReceiptDebug('ocr', {
          event: 'receipt_preview_categorized',
          merchantName: categorizedResult.merchantName,
          providerName: provider.providerName,
        })

        return categorizedResult
      } catch {
        return previewResult
      }
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
      error.message === 'Sign in before processing receipts.' ||
      error.message === 'This account is not allowed to process receipts.' ||
      error.message === 'Receipt OCR provider is not supported.' ||
      error.message === 'Receipt OCR is not configured yet.' ||
      error.message === 'No line items were detected. Try a clearer photo.'
    ) {
      return error
    }

    return new Error('Receipt OCR failed. Try another photo.')
  }

  return new Error('Receipt OCR failed. Try another photo.')
}
