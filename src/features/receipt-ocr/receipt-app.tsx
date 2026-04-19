import Alert from '@mui/material/Alert'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import SvgIcon from '@mui/material/SvgIcon'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { logReceiptDebug } from './debug'
import { createReceiptFxConversionService } from './fx-rate'
import { ReceiptCaptureScreen } from './receipt-capture-screen'
import {
  indexedDbReceiptRepository,
  type ReceiptRepository,
} from './receipt-repository'
import {
  getSavedReceiptMerchantLabel,
  getSavedReceiptStatusLabel,
  type SavedReceipt,
} from './saved-receipts'
import {
  type ReceiptOcrPreviewResult,
  sanitizeReceiptOcrPreviewResult,
} from './shared'

type ReceiptAppView =
  | { kind: 'capture' }
  | { kind: 'history' }
  | { kind: 'detail'; receiptId: string }

interface ReceiptAppProps {
  analyzeReceipt: (options: {
    data: FormData
  }) => Promise<ReceiptOcrPreviewResult>
  receiptRepository?: ReceiptRepository
}

export function ReceiptApp({
  analyzeReceipt,
  receiptRepository = indexedDbReceiptRepository,
}: ReceiptAppProps) {
  const [receipts, setReceipts] = useState<SavedReceipt[]>([])
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    void receiptRepository
      .listReceipts()
      .then((savedReceipts) => {
        if (!isActive) {
          return
        }

        setReceipts(savedReceipts)
        setStorageError(null)

        void receiptRepository
          .backfillFxConversions(savedReceipts)
          .then((updatedReceipts) => {
            if (!isActive) {
              return
            }

            setReceipts(updatedReceipts)
          })
          .catch(() => {
            // Keep the initial receipt list visible even if FX backfill fails.
          })
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setStorageError(toStorageErrorMessage(error))
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingReceipts(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [receiptRepository])

  return (
    <ReceiptAppShell
      analyzeReceipt={analyzeReceipt}
      isLoadingReceipts={isLoadingReceipts}
      onDeleteReceipt={async (receiptId) => {
        try {
          await receiptRepository.deleteReceipt(receiptId)

          setReceipts((currentReceipts) =>
            currentReceipts.filter((receipt) => receipt.id !== receiptId),
          )
          setStorageError(null)
        } catch (error) {
          setStorageError(toStorageErrorMessage(error))
          throw error
        }
      }}
      onReceiptCaptured={async ({ analysis, imageFile }) => {
        try {
          const savedReceipt = await receiptRepository.saveReceipt({
            analysis,
            imageFile,
          })

          setReceipts((currentReceipts) =>
            sortSavedReceipts([savedReceipt, ...currentReceipts]),
          )
          setStorageError(null)

          return savedReceipt
        } catch (error) {
          throw new Error(toStorageErrorMessage(error))
        }
      }}
      onReceiptReprocessed={async (receipt) => {
        try {
          const imageFile = await loadReceiptImageFile(receipt)
          const formData = new FormData()
          formData.set('receiptImage', imageFile)

          logReceiptDebug('storage', {
            event: 'receipt_reprocess_requested',
            receiptId: receipt.id,
          })

          const analysis = await analyzeReceipt({ data: formData })
          const updatedReceipt = await receiptRepository.updateReceipt({
            analysis,
            receiptId: receipt.id,
          })

          setReceipts((currentReceipts) =>
            currentReceipts.map((currentReceipt) =>
              currentReceipt.id === updatedReceipt.id
                ? updatedReceipt
                : currentReceipt,
            ),
          )
          setStorageError(null)

          return updatedReceipt
        } catch (error) {
          setStorageError(toStorageErrorMessage(error))
          throw error
        }
      }}
      receipts={receipts}
      storageError={storageError}
    />
  )
}

export function CloudReceiptApp({
  analyzeReceipt,
}: {
  analyzeReceipt: (options: {
    data: FormData
  }) => Promise<ReceiptOcrPreviewResult>
}) {
  const cloudReceipts = useQuery(api.receipts.list, {})
  const createReceipt = useMutation(api.receipts.create)
  const deleteReceipt = useMutation(api.receipts.remove)
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl)
  const updateReceipt = useMutation(api.receipts.update)
  const [fxConversionService] = useState(() =>
    createReceiptFxConversionService(),
  )
  const [receipts, setReceipts] = useState<SavedReceipt[]>([])
  const [storageError, setStorageError] = useState<string | null>(null)

  useEffect(() => {
    if (cloudReceipts === undefined) {
      return
    }

    setReceipts(cloudReceipts)
    setStorageError(null)
  }, [cloudReceipts])

  return (
    <ReceiptAppShell
      analyzeReceipt={analyzeReceipt}
      isLoadingReceipts={cloudReceipts === undefined && receipts.length === 0}
      onDeleteReceipt={async (receiptId) => {
        try {
          await deleteReceipt({
            receiptId: receiptId as Id<'receipts'>,
          })

          setReceipts((currentReceipts) =>
            currentReceipts.filter((receipt) => receipt.id !== receiptId),
          )
          setStorageError(null)
        } catch (error) {
          setStorageError(toStorageErrorMessage(error))
          throw error
        }
      }}
      onReceiptCaptured={async ({ analysis, imageFile }) => {
        try {
          const createdAt = new Date().toISOString()
          const sanitizedAnalysis = sanitizeReceiptOcrPreviewResult(analysis)
          const storageId = await uploadReceiptImage({
            file: imageFile,
            generateUploadUrl,
          })
          const fxConversion = await fxConversionService.resolveForReceipt({
            analysis: sanitizedAnalysis,
            createdAt,
          })
          const savedReceipt = await createReceipt({
            analysis: sanitizedAnalysis,
            createdAt,
            fxConversion,
            imageName: imageFile.name,
            imageType: imageFile.type || 'application/octet-stream',
            storageId,
          })

          setReceipts((currentReceipts) =>
            sortSavedReceipts([savedReceipt, ...currentReceipts]),
          )
          setStorageError(null)

          return savedReceipt
        } catch (error) {
          throw new Error(toStorageErrorMessage(error))
        }
      }}
      onReceiptReprocessed={async (receipt) => {
        try {
          const imageFile = await loadReceiptImageFile(receipt)
          const formData = new FormData()
          formData.set('receiptImage', imageFile)

          logReceiptDebug('storage', {
            event: 'receipt_reprocess_requested',
            receiptId: receipt.id,
          })

          const analysis = sanitizeReceiptOcrPreviewResult(
            await analyzeReceipt({ data: formData }),
          )
          const fxConversion = await fxConversionService.resolveForReceipt({
            analysis,
            createdAt: receipt.createdAt,
          })
          const updatedReceipt = await updateReceipt({
            analysis,
            fxConversion,
            receiptId: receipt.id as Id<'receipts'>,
          })

          setReceipts((currentReceipts) =>
            currentReceipts.map((currentReceipt) =>
              currentReceipt.id === updatedReceipt.id
                ? updatedReceipt
                : currentReceipt,
            ),
          )
          setStorageError(null)

          return updatedReceipt
        } catch (error) {
          setStorageError(toStorageErrorMessage(error))
          throw error
        }
      }}
      receipts={receipts}
      storageError={storageError}
    />
  )
}

function ReceiptAppShell({
  analyzeReceipt,
  isLoadingReceipts,
  onDeleteReceipt,
  onReceiptCaptured,
  onReceiptReprocessed,
  receipts,
  storageError,
}: {
  analyzeReceipt: (options: {
    data: FormData
  }) => Promise<ReceiptOcrPreviewResult>
  isLoadingReceipts: boolean
  onDeleteReceipt: (receiptId: string) => Promise<void>
  onReceiptCaptured: (capture: {
    analysis: ReceiptOcrPreviewResult
    imageFile: File
  }) => Promise<SavedReceipt>
  onReceiptReprocessed: (receipt: SavedReceipt) => Promise<SavedReceipt>
  receipts: SavedReceipt[]
  storageError: string | null
}) {
  const [view, setView] = useState<ReceiptAppView>({ kind: 'capture' })
  const selectedReceipt =
    view.kind === 'detail'
      ? (receipts.find((receipt) => receipt.id === view.receiptId) ?? null)
      : null

  useEffect(() => {
    if (view.kind === 'detail' && !selectedReceipt && !isLoadingReceipts) {
      setView({ kind: 'history' })
    }
  }, [isLoadingReceipts, selectedReceipt, view])

  const navigationValue = view.kind === 'capture' ? 'capture' : 'history'

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
          flexDirection: 'column',
          px: 2,
          pt: 3,
          pb: 12,
        }}
      >
        <Stack spacing={2.5} sx={{ flex: 1 }}>
          {storageError ? (
            <Alert severity="warning">{storageError}</Alert>
          ) : null}

          <Paper
            elevation={0}
            sx={{
              flex: 1,
              borderRadius: 6,
              px: 3,
              py: 3,
              bgcolor: 'rgba(255, 252, 245, 0.84)',
              border: '1px solid rgba(63, 45, 25, 0.08)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 20px 60px rgba(86, 62, 29, 0.08)',
            }}
          >
            {view.kind === 'capture' ? (
              <ReceiptCaptureScreen
                analyzeReceipt={analyzeReceipt}
                onCaptureSuccess={async (capture) => {
                  const savedReceipt = await onReceiptCaptured(capture)
                  setView({ kind: 'detail', receiptId: savedReceipt.id })
                }}
              />
            ) : null}

            {view.kind === 'history' ? (
              <ReceiptHistoryScreen
                isLoading={isLoadingReceipts}
                receipts={receipts}
                onOpenReceipt={(receiptId) => {
                  setView({ kind: 'detail', receiptId })
                }}
              />
            ) : null}

            {view.kind === 'detail' ? (
              <ReceiptDetailScreen
                key={selectedReceipt?.id ?? 'missing-receipt'}
                isLoading={isLoadingReceipts}
                onDeleteReceipt={async (receiptId) => {
                  await onDeleteReceipt(receiptId)
                  setView({ kind: 'history' })
                }}
                onReprocessReceipt={async (receipt) => {
                  const updatedReceipt = await onReceiptReprocessed(receipt)
                  setView({ kind: 'detail', receiptId: updatedReceipt.id })
                }}
                receipt={selectedReceipt}
                onBack={() => {
                  setView({ kind: 'history' })
                }}
              />
            ) : null}
          </Paper>
        </Stack>
      </Container>

      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          left: '50%',
          bottom: 16,
          width: 'min(100% - 24px, 560px)',
          transform: 'translateX(-50%)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <BottomNavigation
          showLabels
          value={navigationValue}
          onChange={(_event, value: 'capture' | 'history') => {
            setView({ kind: value })
          }}
          sx={{
            height: 72,
            bgcolor: 'rgba(255, 252, 245, 0.94)',
            '& .MuiBottomNavigationAction-root': {
              color: '#7c6241',
            },
            '& .Mui-selected': {
              color: '#2f7d57',
              fontWeight: 700,
            },
          }}
        >
          <BottomNavigationAction label="Capture" value="capture" />
          <BottomNavigationAction label="History" value="history" />
        </BottomNavigation>
      </Paper>
    </Box>
  )
}

function ReceiptHistoryScreen({
  isLoading,
  onOpenReceipt,
  receipts,
}: {
  isLoading: boolean
  onOpenReceipt: (receiptId: string) => void
  receipts: SavedReceipt[]
}) {
  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.75}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#2f2417' }}>
          History
        </Typography>
        <Typography sx={{ color: '#5a4a36' }}>
          Saved receipts sync securely to your account.
        </Typography>
      </Stack>

      {isLoading ? (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: 'center' }}
          data-testid="receipt-history-loading"
        >
          <CircularProgress size={18} sx={{ color: '#2f7d57' }} />
          <Typography sx={{ color: '#5a4a36' }}>Loading receipts...</Typography>
        </Stack>
      ) : null}

      {!isLoading && receipts.length === 0 ? (
        <Stack
          spacing={1}
          sx={{
            borderRadius: 4,
            border: '1px dashed rgba(63, 45, 25, 0.16)',
            bgcolor: 'rgba(255, 255, 255, 0.58)',
            p: 2.5,
          }}
        >
          <Typography sx={{ fontWeight: 600, color: '#2f2417' }}>
            No saved receipts yet
          </Typography>
          <Typography sx={{ color: '#6b5a45' }}>
            Process a receipt from Capture and it will show up here.
          </Typography>
        </Stack>
      ) : null}

      {receipts.length > 0 ? (
        <List
          disablePadding
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid rgba(63, 45, 25, 0.1)',
            bgcolor: 'rgba(255, 255, 255, 0.62)',
          }}
        >
          {receipts.map((receipt, index) => (
            <Box key={receipt.id}>
              {index > 0 ? <Divider /> : null}
              <ListItemButton
                aria-label={`Open receipt from ${getSavedReceiptMerchantLabel(
                  receipt.merchant,
                )}`}
                onClick={() => {
                  onOpenReceipt(receipt.id)
                }}
                sx={{ py: 1.8, alignItems: 'flex-start' }}
              >
                <Stack spacing={0.75} sx={{ width: '100%' }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography sx={{ fontWeight: 600, color: '#2f2417' }}>
                      {getSavedReceiptMerchantLabel(receipt.merchant)}
                    </Typography>
                    <Chip
                      label={getSavedReceiptStatusLabel(receipt.status)}
                      size="small"
                      color={
                        receipt.status === 'needs-review'
                          ? 'warning'
                          : 'success'
                      }
                      variant="outlined"
                    />
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      justifyContent: 'space-between',
                      color: '#6b5a45',
                    }}
                  >
                    <Typography variant="body2" sx={{ color: 'inherit' }}>
                      {formatCaptureTime(receipt.createdAt)}
                    </Typography>
                    <Stack
                      spacing={0.2}
                      sx={{
                        alignItems: 'flex-end',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#2f2417',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {getPrimaryHistoryAmount(receipt)}
                      </Typography>
                      {getSecondaryHistoryAmount(receipt) ? (
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#6b5a45',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {getSecondaryHistoryAmount(receipt)}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </Stack>
              </ListItemButton>
            </Box>
          ))}
        </List>
      ) : null}
    </Stack>
  )
}

function ReceiptDetailScreen({
  isLoading,
  onBack,
  onDeleteReceipt,
  onReprocessReceipt,
  receipt,
}: {
  isLoading: boolean
  onBack: () => void
  onDeleteReceipt: (receiptId: string) => Promise<void>
  onReprocessReceipt: (receipt: SavedReceipt) => Promise<void>
  receipt: SavedReceipt | null
}) {
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

function formatCaptureTime(createdAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt))
}

function formatPurchaseDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(`${value}T00:00:00`))
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`
}

function describeCategorizationSource(
  source: ReceiptOcrPreviewResult['items'][number]['categorizationSource'],
) {
  switch (source) {
    case 'raw_cache':
      return 'Stored categorization from an exact label match.'
    case 'normalized_cache':
      return 'Stored categorization from a normalized label match.'
    case 'ai_existing':
      return 'AI categorization mapped to an existing taxonomy path.'
    case 'ai_new':
      return 'AI categorization created a new taxonomy path.'
    default:
      return 'Categorization confidence details are unavailable.'
  }
}

function getConfidenceTone(confidence: number) {
  if (confidence >= 0.9) {
    return {
      background: 'rgba(47, 125, 87, 0.12)',
      border: 'rgba(47, 125, 87, 0.32)',
      foreground: '#215740',
      hoverBackground: 'rgba(47, 125, 87, 0.2)',
    }
  }

  if (confidence >= 0.75) {
    return {
      background: 'rgba(176, 127, 42, 0.12)',
      border: 'rgba(176, 127, 42, 0.3)',
      foreground: '#8a6430',
      hoverBackground: 'rgba(176, 127, 42, 0.2)',
    }
  }

  return {
    background: 'rgba(181, 77, 48, 0.12)',
    border: 'rgba(181, 77, 48, 0.3)',
    foreground: '#9b452d',
    hoverBackground: 'rgba(181, 77, 48, 0.2)',
  }
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

function toStorageErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Could not update your receipt history.'
}

function sortSavedReceipts(receipts: SavedReceipt[]) {
  return [...receipts].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
}

function hasReceiptImageSource(receipt: SavedReceipt) {
  return receipt.imageBlob !== null || receipt.imageUrl !== null
}

async function loadReceiptImageFile(receipt: SavedReceipt) {
  if (receipt.imageBlob) {
    return new File([receipt.imageBlob], receipt.imageName, {
      type: receipt.imageType,
    })
  }

  if (!receipt.imageUrl) {
    throw new Error('This receipt image is no longer available.')
  }

  const response = await fetch(receipt.imageUrl)

  if (!response.ok) {
    throw new Error('Could not load this receipt image.')
  }

  const imageBlob = await response.blob()

  return new File([imageBlob], receipt.imageName, {
    type: receipt.imageType || imageBlob.type || 'application/octet-stream',
  })
}

async function uploadReceiptImage({
  file,
  generateUploadUrl,
}: {
  file: File
  generateUploadUrl: (args: Record<string, never>) => Promise<string>
}) {
  const uploadUrl = await generateUploadUrl({})
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error('Could not upload this receipt image.')
  }

  const result = (await response.json()) as {
    storageId?: Id<'_storage'>
  }

  if (!result.storageId) {
    throw new Error('Could not store this receipt image.')
  }

  return result.storageId
}

function hasUsableFxConversion(receipt: SavedReceipt) {
  return (
    receipt.fxConversion !== null &&
    receipt.fxConversion.conversionStatus !== 'unavailable' &&
    receipt.fxConversion.convertedTotal !== null
  )
}

function getPrimaryHistoryAmount(receipt: SavedReceipt) {
  if (hasUsableFxConversion(receipt)) {
    return formatMoney(
      receipt.fxConversion?.convertedTotal ?? null,
      receipt.fxConversion?.targetCurrency ?? null,
    )
  }

  return formatMoney(receipt.total, receipt.currency)
}

function getSecondaryHistoryAmount(receipt: SavedReceipt) {
  if (!hasUsableFxConversion(receipt)) {
    return null
  }

  return formatMoney(receipt.total, receipt.currency)
}

function buildOriginalTotalLabel(receipt: SavedReceipt) {
  return receipt.currency ? `Original total (${receipt.currency})` : 'Total'
}

function buildFxConversionNote(receipt: SavedReceipt) {
  if (receipt.fxConversion === null) {
    return null
  }

  if (receipt.fxConversion.conversionStatus === 'unavailable') {
    return 'Historical conversion was unavailable, so this receipt is shown only in the original currency.'
  }

  const basisLabel =
    receipt.fxConversion.basisKind === 'purchase_date'
      ? `purchase date ${receipt.fxConversion.basisDate}`
      : `capture date ${receipt.fxConversion.basisDate} because the purchase date was missing`
  const prefix =
    receipt.fxConversion.conversionStatus === 'fallback_cached'
      ? 'Cached ECB rate'
      : 'ECB rate'

  return `${prefix} from ${receipt.fxConversion.effectiveRateDate} used for ${basisLabel}.`
}
