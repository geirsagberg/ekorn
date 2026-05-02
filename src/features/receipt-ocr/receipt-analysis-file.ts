import {
  prepareReceiptImageForAnalysis,
  rotateReceiptImageForAnalysis,
} from './receipt-image-preparation'
import {
  type AnalyzeReceiptFn,
  MAX_RECEIPT_IMAGE_SIZE_BYTES,
  type ReceiptImageRotationDegrees,
  type ReceiptImageRotationRequiredResult,
  type ReceiptOcrAnalysisResult,
  type ReceiptOcrPreviewResult,
} from './shared'

const MAX_ROTATION_CORRECTION_ATTEMPTS = 3

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
  let analysisFile = await prepareReceiptImageForAnalysis(file)
  let appliedRotationDegrees: ReceiptImageRotationDegrees[] = []

  for (
    let attempt = 0;
    attempt <= MAX_ROTATION_CORRECTION_ATTEMPTS;
    attempt += 1
  ) {
    validateAnalysisFileSize(analysisFile)

    const result = await analyzeFile(analyzeReceipt, analysisFile)

    if (result.kind === 'parsed') {
      return {
        analysis: result.analysis,
        imageFile: analysisFile,
      }
    }

    if (attempt === MAX_ROTATION_CORRECTION_ATTEMPTS) {
      throw new Error('Could not rotate this receipt image automatically.')
    }

    onRotationRequired?.(result)
    const rotationDegrees = chooseRotationDegrees(
      result.rotationDegrees,
      appliedRotationDegrees,
    )
    appliedRotationDegrees = [...appliedRotationDegrees, rotationDegrees]
    analysisFile = await rotateReceiptImageForAnalysis(
      analysisFile,
      rotationDegrees,
    )
  }

  throw new Error('Could not rotate this receipt image automatically.')
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

function chooseRotationDegrees(
  requestedRotationDegrees: ReceiptImageRotationDegrees,
  attemptedRotationDegrees: ReceiptImageRotationDegrees[],
) {
  if (!attemptedRotationDegrees.includes(requestedRotationDegrees)) {
    return requestedRotationDegrees
  }

  return getUntestedRotationDegrees(attemptedRotationDegrees)
}

function getUntestedRotationDegrees(
  attemptedRotationDegrees: ReceiptImageRotationDegrees[],
): ReceiptImageRotationDegrees {
  for (const rotationDegrees of [90, 180, 270] as const) {
    if (!attemptedRotationDegrees.includes(rotationDegrees)) {
      return rotationDegrees
    }
  }

  return 180
}
