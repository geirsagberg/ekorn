import {
  MAX_RECEIPT_IMAGE_SIZE_BYTES,
  type ReceiptImageRotationDegrees,
} from './shared'

const MAX_RECEIPT_UPLOAD_DIMENSION = 1600
const RECEIPT_UPLOAD_QUALITY = 0.82
const RECEIPT_UPLOAD_MIME_TYPE = 'image/jpeg'

export async function prepareReceiptImageForAnalysis(file: File) {
  try {
    return await normalizeReceiptImageForAnalysis(file)
  } catch {
    logReceiptUpload({
      status: 'preparation_failed',
      originalName: file.name,
      originalSizeBytes: file.size,
      originalType: file.type,
    })
    return file
  }
}

export async function rotateReceiptImageForAnalysis(
  file: File,
  rotationDegrees: ReceiptImageRotationDegrees,
) {
  if (
    typeof document === 'undefined' ||
    typeof createImageBitmap !== 'function'
  ) {
    throw new Error('Could not rotate this receipt image automatically.')
  }

  const imageBitmap = await createImageBitmap(file, {
    imageOrientation: 'none',
  })
  const sourceWidth = imageBitmap.width
  const sourceHeight = imageBitmap.height
  const isQuarterTurn = rotationDegrees === 90 || rotationDegrees === 270
  const targetWidth = isQuarterTurn ? sourceHeight : sourceWidth
  const targetHeight = isQuarterTurn ? sourceWidth : sourceHeight
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext('2d')

  if (!context) {
    imageBitmap.close()
    throw new Error('Could not rotate this receipt image automatically.')
  }

  applyCanvasRotation(context, targetWidth, targetHeight, rotationDegrees)
  context.drawImage(imageBitmap, 0, 0)
  imageBitmap.close()

  const blob = await canvasToBlob(
    canvas,
    RECEIPT_UPLOAD_MIME_TYPE,
    RECEIPT_UPLOAD_QUALITY,
  )

  if (!blob) {
    throw new Error('Could not rotate this receipt image automatically.')
  }

  const rotatedFile = new File(
    [blob],
    buildUploadFileName(file.name, blob.type || RECEIPT_UPLOAD_MIME_TYPE),
    {
      type: blob.type || RECEIPT_UPLOAD_MIME_TYPE,
      lastModified: file.lastModified,
    },
  )

  logReceiptUpload({
    status: 'rotation_applied',
    originalName: file.name,
    originalSizeBytes: file.size,
    originalType: file.type,
    rotationDegrees,
    rotatedName: rotatedFile.name,
    rotatedSizeBytes: rotatedFile.size,
    rotatedType: rotatedFile.type,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
  })

  return rotatedFile
}

async function normalizeReceiptImageForAnalysis(file: File) {
  if (
    typeof document === 'undefined' ||
    typeof createImageBitmap !== 'function'
  ) {
    logReceiptUpload({
      status: 'preparation_unavailable',
      originalName: file.name,
      originalSizeBytes: file.size,
      originalType: file.type,
    })
    return file
  }

  const imageBitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  })
  const sourceWidth = imageBitmap.width
  const sourceHeight = imageBitmap.height
  const { width, height } = getScaledDimensions(sourceWidth, sourceHeight)
  const shouldResize = width !== sourceWidth || height !== sourceHeight
  const outputType = shouldConvertToJpeg(file.type)
    ? RECEIPT_UPLOAD_MIME_TYPE
    : file.type
  const shouldNormalizeOrientation = shouldBakeOrientation(file.type)

  if (
    !shouldResize &&
    outputType === file.type &&
    !shouldNormalizeOrientation
  ) {
    imageBitmap.close()
    logReceiptUpload({
      status: 'kept_original',
      originalName: file.name,
      originalSizeBytes: file.size,
      originalType: file.type,
      width: sourceWidth,
      height: sourceHeight,
    })
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')

  if (!context) {
    imageBitmap.close()
    logReceiptUpload({
      status: 'preparation_context_unavailable',
      originalName: file.name,
      originalSizeBytes: file.size,
      originalType: file.type,
    })
    return file
  }

  context.drawImage(imageBitmap, 0, 0, width, height)
  imageBitmap.close()

  const blob = await canvasToBlob(
    canvas,
    outputType,
    outputType === RECEIPT_UPLOAD_MIME_TYPE
      ? RECEIPT_UPLOAD_QUALITY
      : undefined,
  )

  if (!blob) {
    logReceiptUpload({
      status: 'preparation_blob_unavailable',
      originalName: file.name,
      originalSizeBytes: file.size,
      originalType: file.type,
      targetWidth: width,
      targetHeight: height,
      outputType,
    })
    return file
  }

  const preparedFile = new File(
    [blob],
    buildUploadFileName(file.name, blob.type || outputType),
    {
      type: blob.type || outputType,
      lastModified: file.lastModified,
    },
  )

  if (
    preparedFile.size >= file.size &&
    file.size <= MAX_RECEIPT_IMAGE_SIZE_BYTES &&
    outputType === file.type &&
    !shouldNormalizeOrientation
  ) {
    logReceiptUpload({
      status: 'kept_original',
      originalName: file.name,
      originalSizeBytes: file.size,
      originalType: file.type,
      width: sourceWidth,
      height: sourceHeight,
    })
    return file
  }

  logReceiptUpload({
    status: shouldNormalizeOrientation ? 'orientation_normalized' : 'resized',
    originalName: file.name,
    originalSizeBytes: file.size,
    originalType: file.type,
    preparedName: preparedFile.name,
    preparedSizeBytes: preparedFile.size,
    preparedType: preparedFile.type,
    sourceWidth,
    sourceHeight,
    targetWidth: width,
    targetHeight: height,
  })

  return preparedFile
}

function getScaledDimensions(sourceWidth: number, sourceHeight: number) {
  const scale = Math.min(
    1,
    MAX_RECEIPT_UPLOAD_DIMENSION / Math.max(sourceWidth, sourceHeight),
  )

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

function shouldConvertToJpeg(mimeType: string) {
  return mimeType === 'image/jpeg' || mimeType === 'image/png'
}

function shouldBakeOrientation(mimeType: string) {
  return mimeType === 'image/jpeg'
}

function applyCanvasRotation(
  context: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number,
  rotationDegrees: ReceiptImageRotationDegrees,
) {
  switch (rotationDegrees) {
    case 90:
      context.translate(targetWidth, 0)
      context.rotate(Math.PI / 2)
      break
    case 180:
      context.translate(targetWidth, targetHeight)
      context.rotate(Math.PI)
      break
    case 270:
      context.translate(0, targetHeight)
      context.rotate(-Math.PI / 2)
      break
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

function buildUploadFileName(fileName: string, mimeType: string) {
  if (mimeType !== RECEIPT_UPLOAD_MIME_TYPE) {
    return fileName
  }

  return `${fileName.replace(/\.[^.]+$/, '')}.jpg`
}

function logReceiptUpload(details: Record<string, string | number>) {
  console.info(`[receipt-upload] ${JSON.stringify(details)}`)
}
