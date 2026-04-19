import Alert from '@mui/material/Alert'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import { PwaInstallPrompt } from '#/integrations/pwa/install-prompt'
import { ReceiptCaptureScreen } from './receipt-capture-screen'
import { ReceiptDetailScreen } from './receipt-detail-screen'
import { ReceiptHistoryScreen } from './receipt-history-screen'
import type { SavedReceipt } from './saved-receipts'
import type { AnalyzeReceiptFn, ReceiptOcrPreviewResult } from './shared'

export type ReceiptFlowView =
  | { kind: 'capture' }
  | { kind: 'history' }
  | { kind: 'detail'; receiptId: string }

interface ReceiptFlowScreenProps {
  analyzeReceipt: AnalyzeReceiptFn
  isLoadingReceipts: boolean
  onCaptureSuccess: (capture: {
    analysis: ReceiptOcrPreviewResult
    imageFile: File
  }) => Promise<void>
  onDeleteReceipt: (receiptId: string) => Promise<void>
  onOpenReceipt: (receiptId: string) => void
  onReprocessReceipt: (receipt: SavedReceipt) => Promise<void>
  onViewChange: (view: ReceiptFlowView) => void
  receipts: SavedReceipt[]
  selectedReceipt: SavedReceipt | null
  storageError: string | null
  view: ReceiptFlowView
}

export function ReceiptFlowScreen({
  analyzeReceipt,
  isLoadingReceipts,
  onCaptureSuccess,
  onDeleteReceipt,
  onOpenReceipt,
  onReprocessReceipt,
  onViewChange,
  receipts,
  selectedReceipt,
  storageError,
  view,
}: ReceiptFlowScreenProps) {
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
          <PwaInstallPrompt isActive={view.kind !== 'detail'} />

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
                onCaptureSuccess={onCaptureSuccess}
              />
            ) : null}

            {view.kind === 'history' ? (
              <ReceiptHistoryScreen
                isLoading={isLoadingReceipts}
                receipts={receipts}
                onOpenReceipt={onOpenReceipt}
              />
            ) : null}

            {view.kind === 'detail' ? (
              <ReceiptDetailScreen
                isLoading={isLoadingReceipts}
                onBack={() => {
                  onViewChange({ kind: 'history' })
                }}
                onDeleteReceipt={onDeleteReceipt}
                onReprocessReceipt={onReprocessReceipt}
                receipt={selectedReceipt}
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
            onViewChange({ kind: value })
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
