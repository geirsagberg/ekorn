import { createServerFn } from '@tanstack/react-start'
import { createReceiptOcrProvider } from './providers'
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

    try {
      const provider = createReceiptOcrProvider()

      return await provider.analyzeReceipt(file)
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
