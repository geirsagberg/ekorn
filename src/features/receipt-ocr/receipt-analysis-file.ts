import {
  prepareReceiptImageForAnalysis,
  rotateReceiptImageForAnalysis,
} from './receipt-image-preparation'
import {
  type AnalyzeReceiptFn,
  MAX_RECEIPT_IMAGE_SIZE_BYTES,
  type ReceiptImageRotationRequiredResult,
  type ReceiptOcrAnalysisResult,
  type ReceiptOcrPreviewResult,
} from './shared'

export interface AnalyzeReceiptImageFileOptions {
  analyzeReceipt: AnalyzeReceiptFn
  file: File
  onRotationRequired?: (result: ReceiptImageRotationRequiredResult) => void
}

export interface AnalyzeReceiptImageFileResult {
  analysis: ReceiptOcrPreviewResult
  imageFile: File
}

export async function analyzeReceiptImageFile({
  analyzeReceipt,
  file,
  onRotationRequired,
}: AnalyzeReceiptImageFileOptions): Promise<AnalyzeReceiptImageFileResult> {
  const preparedFile = await prepareReceiptImageForAnalysis(file)
  validateAnalysisFileSize(preparedFile)

  const firstResult = await analyzeFile(analyzeReceipt, preparedFile)

  if (firstResult.kind === 'parsed') {
    return {
      analysis: firstResult.analysis,
      imageFile: preparedFile,
    }
  }

  onRotationRequired?.(firstResult)

  const rotatedFile = await rotateReceiptImageForAnalysis(
    preparedFile,
    firstResult.rotationDegrees,
  )
  validateAnalysisFileSize(rotatedFile)

  const retryResult = await analyzeFile(analyzeReceipt, rotatedFile)

  if (retryResult.kind === 'rotation_required') {
    throw new Error('Receipt image still appears rotated after correction.')
  }

  return {
    analysis: retryResult.analysis,
    imageFile: rotatedFile,
  }
}

async function analyzeFile(
  analyzeReceipt: AnalyzeReceiptFn,
  file: File,
): Promise<ReceiptOcrAnalysisResult> {
  const formData = new FormData()
  formData.set('receiptImage', file)

  return await analyzeReceipt({ data: formData })
}

function validateAnalysisFileSize(file: File) {
  if (file.size > MAX_RECEIPT_IMAGE_SIZE_BYTES) {
    throw new Error('Choose an image smaller than 10 MB.')
  }
}
