import { createServerFn } from '@tanstack/react-start'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { isLocalAuthBypassEnabled } from '#/integrations/auth/local-bypass'
import {
  authPolicyMessages,
  requireAllowlistedEmail,
  requireAuthenticatedValue,
} from '#/integrations/auth/server-access-policy'
import { categorizeReceiptPreviewResult } from './categorization'
import { logReceiptDebug } from './debug'
import { createReceiptOcrProvider } from './providers'
import {
  MAX_RECEIPT_IMAGE_SIZE_BYTES,
  type ReceiptOcrAnalysisResult,
} from './shared'

export const analyzeReceiptPreview = createServerFn({ method: 'POST' })
  .inputValidator((data: FormData) => data)
  .handler(async ({ data }): Promise<ReceiptOcrAnalysisResult> => {
    if (!isLocalAuthBypassEnabled()) {
      const { user } = await getAuth()
      const authenticatedUser = requireAuthenticatedValue(
        user,
        authPolicyMessages.receiptProcessingRequiresSignIn,
      )

      requireAllowlistedEmail(authenticatedUser.email ?? null, {
        notAllowedMessage: authPolicyMessages.receiptProcessingNotAllowed,
      })
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
      const analysisResult = await provider.analyzeReceipt(file)

      if (analysisResult.kind === 'rotation_required') {
        logReceiptDebug('ocr', {
          event: 'receipt_rotation_required',
          providerName: provider.providerName,
          rotationDegrees: analysisResult.rotationDegrees,
        })

        return analysisResult
      }

      const previewResult = analysisResult.analysis

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

        return {
          kind: 'parsed',
          analysis: categorizedResult,
        }
      } catch (error) {
        logReceiptDebug('categorization', {
          event: 'receipt_preview_categorization_failed',
          errorMessage: error instanceof Error ? error.message : 'unknown',
          providerName: provider.providerName,
        })

        return {
          kind: 'parsed',
          analysis: previewResult,
        }
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
      error.message === authPolicyMessages.receiptProcessingRequiresSignIn ||
      error.message === authPolicyMessages.receiptProcessingNotAllowed ||
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
