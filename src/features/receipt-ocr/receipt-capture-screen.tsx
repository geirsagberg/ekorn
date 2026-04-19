import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  MAX_RECEIPT_IMAGE_SIZE_BYTES,
  type ReceiptOcrPreviewResult,
} from './shared'

interface SelectedPhoto {
  fileName: string
  fileSizeLabel: string
  previewUrl: string
}

const MAX_RECEIPT_UPLOAD_DIMENSION = 1600
const RECEIPT_UPLOAD_QUALITY = 0.82
const RECEIPT_UPLOAD_MIME_TYPE = 'image/jpeg'

type CaptureStatus = 'idle' | 'analyzing' | 'error'

interface ReceiptCaptureScreenProps {
  analyzeReceipt: (options: {
    data: FormData
  }) => Promise<ReceiptOcrPreviewResult>
  onCaptureSuccess: (capture: {
    analysis: ReceiptOcrPreviewResult
    imageFile: File
  }) => Promise<void>
}

export function ReceiptCaptureScreen({
  analyzeReceipt,
  onCaptureSuccess,
}: ReceiptCaptureScreenProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null)
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const requestSequence = useRef(0)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    return () => {
      if (selectedPhoto) {
        URL.revokeObjectURL(selectedPhoto.previewUrl)
      }
    }
  }, [selectedPhoto])

  const handlePhotoSelection = async (
    event: ChangeEvent<HTMLInputElement> | FormEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setCaptureStatus('error')
      setErrorMessage('Choose an image file from your camera or photo library.')
      return
    }

    if (file.size > MAX_RECEIPT_IMAGE_SIZE_BYTES) {
      setCaptureStatus('error')
      setErrorMessage('Choose an image smaller than 10 MB.')
      return
    }

    setErrorMessage(null)
    setCaptureStatus('analyzing')
    setSelectedPhoto((currentPhoto) => {
      if (currentPhoto) {
        URL.revokeObjectURL(currentPhoto.previewUrl)
      }

      return {
        fileName: file.name,
        fileSizeLabel: formatFileSize(file.size),
        previewUrl: URL.createObjectURL(file),
      }
    })

    const currentRequest = ++requestSequence.current
    const uploadFile = await prepareReceiptUpload(file)

    if (requestSequence.current !== currentRequest) {
      return
    }

    if (uploadFile.size > MAX_RECEIPT_IMAGE_SIZE_BYTES) {
      setCaptureStatus('error')
      setErrorMessage('Choose an image smaller than 10 MB.')
      return
    }

    const formData = new FormData()
    formData.set('receiptImage', uploadFile)

    try {
      await waitForNextPaint()
      const result = await analyzeReceipt({ data: formData })

      if (requestSequence.current !== currentRequest) {
        return
      }

      await onCaptureSuccess({
        analysis: result,
        imageFile: file,
      })

      if (requestSequence.current !== currentRequest) {
        return
      }

      setCaptureStatus('idle')
      setSelectedPhoto(null)
    } catch (error) {
      if (requestSequence.current !== currentRequest) {
        return
      }

      setCaptureStatus('error')
      setErrorMessage(getErrorMessage(error))
    }
  }

  return (
    <Container maxWidth="sm" disableGutters>
      <Stack spacing={3}>
        {isHydrated ? (
          <Box
            aria-hidden="true"
            data-testid="receipt-capture-ready"
            sx={{ display: 'none' }}
          />
        ) : null}

        <Stack spacing={1}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#2f2417',
            }}
          >
            Capture
          </Typography>
          <Typography sx={{ color: '#5a4a36' }}>
            Add one photo and we will save successful receipts automatically.
          </Typography>
        </Stack>

        <Button
          component="label"
          variant="contained"
          size="large"
          disabled={captureStatus === 'analyzing'}
          sx={{
            borderRadius: 999,
            py: 1.6,
            fontWeight: 700,
            textTransform: 'none',
            bgcolor: '#2f7d57',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: '#256546',
              boxShadow: 'none',
            },
          }}
        >
          {selectedPhoto ? 'Choose another photo' : 'Add photo'}
          <input
            hidden
            aria-label="Receipt photo"
            accept="image/*"
            type="file"
            onChange={handlePhotoSelection}
            onInput={handlePhotoSelection}
          />
        </Button>

        {selectedPhoto ? (
          <Stack spacing={2.5}>
            <Box
              component="img"
              src={selectedPhoto.previewUrl}
              alt={`Receipt preview for ${selectedPhoto.fileName}`}
              sx={{
                width: '100%',
                borderRadius: 4,
                border: '1px solid rgba(63, 45, 25, 0.1)',
                bgcolor: '#f2ede5',
                objectFit: 'cover',
                aspectRatio: '3 / 4',
                boxShadow: '0 16px 40px rgba(63, 45, 25, 0.12)',
              }}
            />
            <Stack spacing={0.5}>
              <Typography sx={{ fontWeight: 600, color: '#2f2417' }}>
                {selectedPhoto.fileName}
              </Typography>
              <Typography variant="body2" sx={{ color: '#7c6241' }}>
                {selectedPhoto.fileSizeLabel}
              </Typography>
            </Stack>
          </Stack>
        ) : null}

        {captureStatus === 'analyzing' ? (
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'center' }}
            data-testid="receipt-processing"
          >
            <CircularProgress size={18} sx={{ color: '#2f7d57' }} />
            <Typography sx={{ color: '#5a4a36' }}>
              Processing receipt...
            </Typography>
          </Stack>
        ) : null}

        {errorMessage ? (
          <Alert severity="error" data-testid="ocr-error">
            {errorMessage}
          </Alert>
        ) : null}
      </Stack>
    </Container>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Receipt OCR failed. Try another photo.'
}

function formatFileSize(fileSizeInBytes: number) {
  if (fileSizeInBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(fileSizeInBytes / 1024))} KB`
  }

  return `${(fileSizeInBytes / (1024 * 1024)).toFixed(1)} MB`
}

async function prepareReceiptUpload(file: File) {
  try {
    return await downscaleReceiptImage(file)
  } catch {
    logReceiptUpload({
      status: 'resize_failed',
      originalName: file.name,
      originalSizeBytes: file.size,
      originalType: file.type,
    })
    return file
  }
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

async function downscaleReceiptImage(file: File) {
  if (
    typeof document === 'undefined' ||
    typeof createImageBitmap !== 'function'
  ) {
    logReceiptUpload({
      status: 'resize_unavailable',
      originalName: file.name,
      originalSizeBytes: file.size,
      originalType: file.type,
    })
    return file
  }

  const imageBitmap = await createImageBitmap(file)
  const sourceWidth = imageBitmap.width
  const sourceHeight = imageBitmap.height
  const { width, height } = getScaledDimensions(sourceWidth, sourceHeight)
  const shouldResize = width !== sourceWidth || height !== sourceHeight
  const outputType = shouldConvertToJpeg(file.type)
    ? RECEIPT_UPLOAD_MIME_TYPE
    : file.type

  if (!shouldResize && outputType === file.type) {
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
      status: 'resize_context_unavailable',
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
      status: 'resize_blob_unavailable',
      originalName: file.name,
      originalSizeBytes: file.size,
      originalType: file.type,
      targetWidth: width,
      targetHeight: height,
      outputType,
    })
    return file
  }

  const resizedFile = new File(
    [blob],
    buildUploadFileName(file.name, blob.type || outputType),
    {
      type: blob.type || outputType,
      lastModified: file.lastModified,
    },
  )

  if (
    resizedFile.size >= file.size &&
    file.size <= MAX_RECEIPT_IMAGE_SIZE_BYTES &&
    outputType === file.type
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
    status: 'resized',
    originalName: file.name,
    originalSizeBytes: file.size,
    originalType: file.type,
    resizedName: resizedFile.name,
    resizedSizeBytes: resizedFile.size,
    resizedType: resizedFile.type,
    sourceWidth,
    sourceHeight,
    targetWidth: width,
    targetHeight: height,
  })

  return resizedFile
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
