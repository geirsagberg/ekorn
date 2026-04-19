import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  formatCaptureTime,
  getPrimaryHistoryAmount,
  getSecondaryHistoryAmount,
} from './receipt-flow-formatting'
import {
  getSavedReceiptMerchantLabel,
  getSavedReceiptStatusLabel,
  type SavedReceipt,
} from './saved-receipts'

interface ReceiptHistoryScreenProps {
  isLoading: boolean
  onOpenReceipt: (receiptId: string) => void
  receipts: SavedReceipt[]
}

export function ReceiptHistoryScreen({
  isLoading,
  onOpenReceipt,
  receipts,
}: ReceiptHistoryScreenProps) {
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
