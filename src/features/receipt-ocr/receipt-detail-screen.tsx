import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import SvgIcon from '@mui/material/SvgIcon'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import {
  buildDisplayItems,
  buildFxConversionNote,
  buildOriginalTotalLabel,
  buildSanityWarning,
  describeCategorizationSource,
  formatCaptureTime,
  formatConfidence,
  formatMoney,
  formatPurchaseDate,
  getConfidenceTone,
  hasReceiptImageSource,
  hasUsableFxConversion,
} from './receipt-flow-formatting'
import {
  getSavedReceiptMerchantLabel,
  getSavedReceiptStatusLabel,
  type SavedReceipt,
} from './saved-receipts'
import type { ReceiptOcrPreviewResult } from './shared'

interface ReceiptDetailScreenProps {
  isLoading: boolean
  onBack: () => void
  onDeleteReceipt: (receiptId: string) => Promise<void>
  onReprocessReceipt: (receipt: SavedReceipt) => Promise<void>
  receipt: SavedReceipt | null
}

export function ReceiptDetailScreen({
  isLoading,
  onBack,
  onDeleteReceipt,
  onReprocessReceipt,
  receipt,
}: ReceiptDetailScreenProps) {
  const [isImageVisible, setIsImageVisible] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)

  useEffect(() => {
    if (!isImageVisible || !receipt) {
      setImageUrl((currentUrl) => {
        if (currentUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(currentUrl)
        }

        return null
      })
      return
    }

    if (receipt.imageUrl) {
      setImageUrl(receipt.imageUrl)
      return
    }

    if (!receipt.imageBlob) {
      setImageUrl(null)
      return
    }

    const nextImageUrl = URL.createObjectURL(receipt.imageBlob)
    setImageUrl(nextImageUrl)

    return () => {
      URL.revokeObjectURL(nextImageUrl)
    }
  }, [isImageVisible, receipt])

  if (isLoading && !receipt) {
    return (
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center' }}
        data-testid="receipt-detail-loading"
      >
        <CircularProgress size={18} sx={{ color: '#2f7d57' }} />
        <Typography sx={{ color: '#5a4a36' }}>Loading receipt...</Typography>
      </Stack>
    )
  }

  if (!receipt) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#2f2417' }}>
          Receipt detail
        </Typography>
        <Alert severity="warning">That receipt is no longer available.</Alert>
        <Button
          variant="outlined"
          onClick={onBack}
          sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
        >
          Back to history
        </Button>
      </Stack>
    )
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5 }}>
        <Stack spacing={0.75}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#2f2417' }}>
            Receipt detail
          </Typography>
          <Typography sx={{ color: '#5a4a36' }}>
            {getSavedReceiptMerchantLabel(receipt.merchant)}
          </Typography>
        </Stack>
        <Chip
          label={getSavedReceiptStatusLabel(receipt.status)}
          color={receipt.status === 'needs-review' ? 'warning' : 'success'}
          variant="outlined"
        />
      </Stack>

      <Stack spacing={1}>
        <SummaryRow
          label="Captured"
          value={formatCaptureTime(receipt.createdAt)}
        />
        {receipt.analysis.purchaseDate ? (
          <SummaryRow
            label="Purchase date"
            value={formatPurchaseDate(receipt.analysis.purchaseDate)}
          />
        ) : null}
        <SummaryRow
          label={buildOriginalTotalLabel(receipt)}
          value={formatMoney(receipt.total, receipt.currency)}
        />
        {hasUsableFxConversion(receipt) ? (
          <SummaryRow
            label={`Home total (${receipt.fxConversion?.targetCurrency})`}
            value={formatMoney(
              receipt.fxConversion?.convertedTotal ?? null,
              receipt.fxConversion?.targetCurrency ?? null,
            )}
          />
        ) : null}
      </Stack>

      {buildFxConversionNote(receipt) ? (
        <Typography variant="body2" sx={{ color: '#5a4a36' }}>
          {buildFxConversionNote(receipt)}
        </Typography>
      ) : null}

      <Button
        disabled={isReprocessing || !hasReceiptImageSource(receipt)}
        variant="outlined"
        onClick={async () => {
          setIsReprocessing(true)

          try {
            await onReprocessReceipt(receipt)
          } finally {
            setIsReprocessing(false)
          }
        }}
        sx={{
          alignSelf: 'flex-start',
          borderRadius: 999,
          textTransform: 'none',
        }}
      >
        {isReprocessing ? 'Reprocessing receipt...' : 'Reprocess image'}
      </Button>

      <Button
        disabled={!hasReceiptImageSource(receipt)}
        variant="outlined"
        onClick={() => {
          setIsImageVisible((currentValue) => !currentValue)
        }}
        sx={{
          alignSelf: 'flex-start',
          borderRadius: 999,
          textTransform: 'none',
        }}
      >
        {isImageVisible ? 'Hide receipt image' : 'View receipt image'}
      </Button>

      {isImageVisible && imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt={`Receipt image for ${receipt.imageName}`}
          sx={{
            width: '100%',
            borderRadius: 4,
            border: '1px solid rgba(63, 45, 25, 0.1)',
            bgcolor: '#f2ede5',
            objectFit: 'cover',
            aspectRatio: '3 / 4',
          }}
        />
      ) : null}

      <ReceiptStructuredDetail result={receipt.analysis} />

      <Button
        color="error"
        disabled={isReprocessing}
        variant="outlined"
        onClick={() => setIsDeleteDialogOpen(true)}
        sx={{
          alignSelf: 'flex-start',
          borderRadius: 999,
          textTransform: 'none',
        }}
      >
        Delete receipt
      </Button>

      <Button
        variant="text"
        onClick={onBack}
        sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
      >
        Back to history
      </Button>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete receipt?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes the saved receipt from your account history, but keeps
            learned categorization data for future captures.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setIsDeleteDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            onClick={async () => {
              setIsDeleteDialogOpen(false)
              await onDeleteReceipt(receipt.id)
            }}
            sx={{ textTransform: 'none' }}
          >
            Delete receipt
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

function ReceiptStructuredDetail({
  result,
}: {
  result: ReceiptOcrPreviewResult
}) {
  return (
    <Stack spacing={2}>
      {result.sanityCheck.status === 'warning' ? (
        <Alert severity="warning" data-testid="receipt-sanity-warning">
          {buildSanityWarning(result)}
        </Alert>
      ) : null}

      {result.rawWarnings
        .filter(
          (warning) =>
            warning !== 'Line item amounts do not match the receipt summary.',
        )
        .map((warning) => (
          <Alert key={warning} severity="warning">
            {warning}
          </Alert>
        ))}

      <Stack spacing={1}>
        <Typography sx={{ fontWeight: 700, color: '#2f2417' }}>
          Structured receipt
        </Typography>
        <Stack
          spacing={1}
          sx={{
            borderRadius: 3,
            border: '1px solid rgba(63, 45, 25, 0.1)',
            bgcolor: 'rgba(255, 255, 255, 0.65)',
            p: 1.5,
          }}
          data-testid="receipt-line-items"
        >
          {buildDisplayItems(result.items).map(({ item, key }) => (
            <Stack key={key} spacing={0.9} data-testid="receipt-line-item">
              <Stack
                direction="row"
                spacing={2}
                sx={{ justifyContent: 'space-between' }}
              >
                <Typography sx={{ color: '#2f2417' }}>{item.text}</Typography>
                <Typography
                  sx={{
                    color: '#2f2417',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatMoney(item.amount, result.currency)}
                </Typography>
              </Stack>

              {(item.categories?.length ?? 0) > 0 ? (
                <Stack spacing={0.6}>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{
                      flexWrap: 'wrap',
                      rowGap: 0.75,
                      alignItems: 'center',
                    }}
                  >
                    {(item.categories ?? []).map((category) => (
                      <Chip
                        key={`${key}-${category}`}
                        label={category}
                        size="small"
                        variant={item.isLowConfidence ? 'outlined' : 'filled'}
                        sx={{
                          borderRadius: 999,
                          bgcolor: item.isLowConfidence
                            ? 'transparent'
                            : 'rgba(47, 125, 87, 0.12)',
                          borderColor: item.isLowConfidence
                            ? 'rgba(176, 127, 42, 0.35)'
                            : 'transparent',
                          color: item.isLowConfidence ? '#8a6430' : '#215740',
                          '& .MuiChip-label': {
                            px: 1.1,
                            fontWeight: 600,
                          },
                        }}
                      />
                    ))}
                    {item.categorizationConfidence !== null ? (
                      <ConfidenceInfoButton
                        confidence={item.categorizationConfidence}
                        source={item.categorizationSource}
                      />
                    ) : null}
                  </Stack>
                </Stack>
              ) : item.categorizationConfidence !== null ? (
                <Typography variant="caption" sx={{ color: '#8a6430' }}>
                  Suggested category confidence:{' '}
                  {formatConfidence(item.categorizationConfidence)}
                </Typography>
              ) : null}
            </Stack>
          ))}
        </Stack>
      </Stack>

      {result.subtotal !== null || result.total !== null ? (
        <Stack spacing={0.75} data-testid="receipt-summary">
          <Typography sx={{ fontWeight: 700, color: '#2f2417' }}>
            Summary
          </Typography>
          {result.purchaseDate ? (
            <SummaryRow
              label="Purchase date"
              value={formatPurchaseDate(result.purchaseDate)}
            />
          ) : null}
          {result.subtotal !== null ? (
            <SummaryRow
              label="Subtotal"
              value={formatMoney(result.subtotal, result.currency)}
            />
          ) : null}
          {result.total !== null ? (
            <SummaryRow
              label="Total"
              value={formatMoney(result.total, result.currency)}
            />
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  )
}

function ConfidenceInfoButton({
  confidence,
  source,
}: {
  confidence: number
  source: ReceiptOcrPreviewResult['items'][number]['categorizationSource']
}) {
  const tone = getConfidenceTone(confidence)
  const confidenceLabel = formatConfidence(confidence)

  return (
    <Tooltip
      arrow
      enterTouchDelay={0}
      title={
        <Stack spacing={0.25}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {confidenceLabel} confidence
          </Typography>
          <Typography variant="caption">
            {describeCategorizationSource(source)}
          </Typography>
        </Stack>
      }
    >
      <IconButton
        aria-label={`Category confidence details: ${confidenceLabel} confidence`}
        size="small"
        sx={{
          width: 24,
          height: 24,
          color: tone.foreground,
          bgcolor: tone.background,
          border: `1px solid ${tone.border}`,
          '&:hover': {
            bgcolor: tone.hoverBackground,
          },
        }}
      >
        <ConfidenceInfoIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5 }}>
      <Typography sx={{ color: '#5a4a36' }}>{label}</Typography>
      <Typography
        sx={{
          color: '#2f2417',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
        }}
      >
        {value}
      </Typography>
    </Stack>
  )
}

function ConfidenceInfoIcon(props: React.ComponentProps<typeof SvgIcon>) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.16" />
      <path
        d="M12 10.1a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3Zm-1.15 2.15c0-.36.29-.65.65-.65h.8c.36 0 .65.29.65.65v4.25h.55c.36 0 .65.29.65.65s-.29.65-.65.65h-2.6a.65.65 0 1 1 0-1.3h.55v-3.6h-.6a.65.65 0 0 1-.65-.65Z"
        fill="currentColor"
      />
    </SvgIcon>
  )
}
