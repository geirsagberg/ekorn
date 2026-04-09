import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
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

type AnalysisStatus =
  | 'idle'
  | 'analyzing'
  | 'success'
  | 'success-with-warning'
  | 'error'

interface ReceiptCaptureScreenProps {
  analyzeReceipt: (options: {
    data: FormData
  }) => Promise<ReceiptOcrPreviewResult>
}

export function ReceiptCaptureScreen({
  analyzeReceipt,
}: ReceiptCaptureScreenProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle')
  const [analysisResult, setAnalysisResult] =
    useState<ReceiptOcrPreviewResult | null>(null)
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
      setAnalysisResult(null)
      setAnalysisStatus('error')
      setErrorMessage('Choose an image file from your camera or photo library.')
      return
    }

    if (file.size > MAX_RECEIPT_IMAGE_SIZE_BYTES) {
      setAnalysisResult(null)
      setAnalysisStatus('error')
      setErrorMessage('Choose an image smaller than 10 MB.')
      return
    }

    setErrorMessage(null)
    setAnalysisResult(null)
    setAnalysisStatus('analyzing')
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
    const formData = new FormData()
    formData.set('receiptImage', file)

    try {
      await waitForNextPaint()
      const result = await analyzeReceipt({ data: formData })

      if (requestSequence.current !== currentRequest) {
        return
      }

      setAnalysisResult(result)
      setAnalysisStatus(
        result.sanityCheck.status === 'warning'
          ? 'success-with-warning'
          : 'success',
      )
    } catch (error) {
      if (requestSequence.current !== currentRequest) {
        return
      }

      setAnalysisStatus('error')
      setErrorMessage(getErrorMessage(error))
    }
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        background:
          'linear-gradient(180deg, #f6f2ea 0%, #efe6d6 42%, #fbf8f2 100%)',
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            borderRadius: 6,
            px: 3,
            py: 4,
            bgcolor: 'rgba(255, 252, 245, 0.82)',
            border: '1px solid rgba(63, 45, 25, 0.08)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 60px rgba(86, 62, 29, 0.08)',
          }}
        >
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
                Add receipt
              </Typography>
              <Typography sx={{ color: '#5a4a36' }}>
                Camera or gallery.
              </Typography>
            </Stack>

            <Button
              component="label"
              variant="contained"
              size="large"
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
                capture="environment"
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

            {analysisStatus === 'analyzing' ? (
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center' }}
                data-testid="ocr-analyzing"
              >
                <CircularProgress size={18} sx={{ color: '#2f7d57' }} />
                <Typography sx={{ color: '#5a4a36' }}>
                  Analyzing receipt...
                </Typography>
              </Stack>
            ) : null}

            {errorMessage ? (
              <Alert severity="error" data-testid="ocr-error">
                {errorMessage}
              </Alert>
            ) : null}

            {analysisResult ? (
              <Stack spacing={2}>
                {analysisStatus === 'success-with-warning' ? (
                  <Alert severity="warning" data-testid="ocr-sanity-warning">
                    {buildSanityWarning(analysisResult)}
                  </Alert>
                ) : null}

                {analysisResult.rawWarnings
                  .filter(
                    (warning) =>
                      warning !==
                      'Line item amounts do not match the receipt summary.',
                  )
                  .map((warning) => (
                    <Alert key={warning} severity="warning">
                      {warning}
                    </Alert>
                  ))}

                <Stack spacing={1}>
                  <Typography sx={{ fontWeight: 700, color: '#2f2417' }}>
                    Extracted lines
                  </Typography>
                  <Stack
                    spacing={1}
                    sx={{
                      borderRadius: 3,
                      border: '1px solid rgba(63, 45, 25, 0.1)',
                      bgcolor: 'rgba(255, 255, 255, 0.65)',
                      p: 1.5,
                    }}
                    data-testid="ocr-line-items"
                  >
                    {buildDisplayItems(analysisResult.items).map(
                      ({ item, key }) => (
                        <Stack
                          key={key}
                          direction="row"
                          spacing={2}
                          sx={{ justifyContent: 'space-between' }}
                          data-testid="ocr-line-item"
                        >
                          <Typography sx={{ color: '#2f2417' }}>
                            {item.text}
                          </Typography>
                          <Typography
                            sx={{
                              color: '#2f2417',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatMoney(item.amount, analysisResult.currency)}
                          </Typography>
                        </Stack>
                      ),
                    )}
                  </Stack>
                </Stack>

                {analysisResult.subtotal !== null ||
                analysisResult.total !== null ? (
                  <Stack spacing={0.75} data-testid="ocr-summary">
                    <Typography sx={{ fontWeight: 700, color: '#2f2417' }}>
                      Summary
                    </Typography>
                    {analysisResult.subtotal !== null ? (
                      <SummaryRow
                        label="Subtotal"
                        value={formatMoney(
                          analysisResult.subtotal,
                          analysisResult.currency,
                        )}
                      />
                    ) : null}
                    {analysisResult.total !== null ? (
                      <SummaryRow
                        label="Total"
                        value={formatMoney(
                          analysisResult.total,
                          analysisResult.currency,
                        )}
                      />
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
      <Typography sx={{ color: '#5a4a36' }}>{label}</Typography>
      <Typography sx={{ color: '#2f2417', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Stack>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Receipt OCR failed. Try another photo.'
}

function buildSanityWarning(result: ReceiptOcrPreviewResult) {
  const targetLabel =
    result.sanityCheck.compareTarget === 'subtotal' ? 'subtotal' : 'total'

  return `Check this receipt. Extracted items sum to ${formatMoney(
    result.sanityCheck.itemSum,
    result.currency,
  )}, while the ${targetLabel} is ${formatMoney(
    result.sanityCheck.expected,
    result.currency,
  )}.`
}

function formatMoney(amount: number | null, currency: string | null) {
  if (amount === null) {
    return '—'
  }

  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      return `${amount.toFixed(2)} ${currency}`
    }
  }

  return amount.toFixed(2)
}

function formatFileSize(fileSizeInBytes: number) {
  if (fileSizeInBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(fileSizeInBytes / 1024))} KB`
  }

  return `${(fileSizeInBytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildDisplayItems(items: ReceiptOcrPreviewResult['items']) {
  const counts = new Map<string, number>()

  return items.map((item) => {
    const baseKey = `${item.text}-${item.amount ?? 'missing'}`
    const seenCount = counts.get(baseKey) ?? 0
    counts.set(baseKey, seenCount + 1)

    return {
      item,
      key: `${baseKey}-${seenCount + 1}`,
    }
  })
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}
