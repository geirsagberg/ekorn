import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { getSignInUrl } from '@workos/authkit-tanstack-react-start'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from 'convex/react'
import { useState } from 'react'
import { analyzeReceiptPreview } from '#/features/receipt-ocr/analyze-receipt'
import { ReceiptFlowApp } from '#/features/receipt-ocr/receipt-flow-app'
import { useConvexReceiptFlowDataSource } from '#/features/receipt-ocr/receipt-flow-data-source'
import { createIndexedDbReceiptFlowDataSource } from '#/features/receipt-ocr/receipt-flow-indexeddb-data-source'
import type { AnalyzeReceiptFn } from '#/features/receipt-ocr/shared'
import {
  AuthenticatedViewerStateProvider,
  useAuthenticatedViewerState,
} from '#/integrations/auth/authenticated-viewer-state'
import { isLocalAuthBypassEnabled } from '#/integrations/auth/local-bypass'
import { useStoreCurrentUserEffect } from '#/integrations/auth/use-store-current-user-effect'
import { api } from '../../convex/_generated/api'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

export const Route = createFileRoute('/')({
  component: App,
  loader: async () => {
    if (isLocalAuthBypassEnabled()) {
      return {
        signInUrl: null,
      }
    }

    return {
      signInUrl: await getSignInUrl(),
    }
  },
})

function App() {
  const analyzeReceipt = useServerFn(analyzeReceiptPreview)
  const { signInUrl } = Route.useLoaderData()

  if (isLocalAuthBypassEnabled()) {
    return <LocalTestingApp analyzeReceipt={analyzeReceipt} />
  }

  if (!CONVEX_URL) {
    return (
      <CenteredState
        title="Convex is not configured"
        body="Set VITE_CONVEX_URL before opening the authenticated receipt app."
        tone="warning"
      />
    )
  }

  return (
    <>
      <AuthLoading>
        <CenteredState
          title="Checking your secure session"
          body="Loading your authenticated receipt workspace."
          isLoading
        />
      </AuthLoading>

      <Unauthenticated>
        <SignInScreen signInUrl={signInUrl} />
      </Unauthenticated>

      <Authenticated>
        <AuthenticatedViewerStateProvider>
          <AuthenticatedApp analyzeReceipt={analyzeReceipt} />
        </AuthenticatedViewerStateProvider>
      </Authenticated>
    </>
  )
}

function AuthenticatedApp({
  analyzeReceipt,
}: {
  analyzeReceipt: AnalyzeReceiptFn
}) {
  const viewer = useQuery(api.users.current, {})
  const syncState = useStoreCurrentUserEffect()
  const viewerState = useAuthenticatedViewerState({
    syncState,
    viewer,
  })

  switch (viewerState.kind) {
    case 'error':
      return (
        <CenteredState
          title="Could not load your account"
          body={viewerState.message}
          tone="error"
        />
      )
    case 'loading':
      return (
        <CenteredState
          title="Preparing your account"
          body="Syncing your secure receipt access."
          isLoading
        />
      )
    case 'expired':
      return (
        <CenteredState
          title="Authentication expired"
          body="Refresh the page and sign in again to continue."
          tone="warning"
        />
      )
    case 'denied':
      return (
        <AccessDeniedScreen
          allowlistConfigured={viewerState.viewer.allowlistConfigured}
          email={viewerState.viewer.email}
        />
      )
    case 'ready':
      return <AllowedReceiptApp analyzeReceipt={analyzeReceipt} />
  }
}

function AllowedReceiptApp({
  analyzeReceipt,
}: {
  analyzeReceipt: AnalyzeReceiptFn
}) {
  const receiptFlow = useConvexReceiptFlowDataSource()

  return (
    <ReceiptFlowApp
      analyzeReceipt={analyzeReceipt}
      dataSource={receiptFlow.dataSource}
      syncState={receiptFlow.syncState}
    />
  )
}

function LocalTestingApp({
  analyzeReceipt,
}: {
  analyzeReceipt: AnalyzeReceiptFn
}) {
  const [dataSource] = useState(() => createIndexedDbReceiptFlowDataSource())

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        background:
          'linear-gradient(180deg, #f6f2ea 0%, #efe6d6 42%, #fbf8f2 100%)',
        py: 2,
      }}
    >
      <Container maxWidth="sm" sx={{ px: 2 }}>
        <Stack spacing={2}>
          <Alert severity="warning">
            Local auth bypass is enabled. Capture and history use local-only
            IndexedDB storage, and sign-in is skipped for debugging.
          </Alert>
          <ReceiptFlowApp
            analyzeReceipt={analyzeReceipt}
            dataSource={dataSource}
          />
        </Stack>
      </Container>
    </Box>
  )
}

function SignInScreen({ signInUrl }: { signInUrl: string | null }) {
  return (
    <CenteredState
      title="Sign in to Ekorn"
      body="Receipt history now syncs to your private account, so sign-in is required before capture and review."
      action={
        <Button
          component="a"
          href={signInUrl ?? '#'}
          variant="contained"
          sx={{
            alignSelf: 'flex-start',
            borderRadius: 999,
            px: 3,
            py: 1.2,
            textTransform: 'none',
            bgcolor: '#2f7d57',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: '#256546',
              boxShadow: 'none',
            },
          }}
        >
          Sign in
        </Button>
      }
    />
  )
}

function AccessDeniedScreen({
  allowlistConfigured,
  email,
}: {
  allowlistConfigured: boolean
  email: string | null
}) {
  const { signOut, user } = useAuth()
  const workosEmail = user?.email ?? null

  return (
    <CenteredState
      title="Access is restricted"
      body={
        allowlistConfigured
          ? `${workosEmail ?? email ?? 'This account'} is signed in, but it is not on the Ekorn allowlist.\n\nWorkOS signed-in email: ${workosEmail ?? 'unavailable'}\nConvex resolved email: ${email ?? 'unavailable'}`
          : 'No allowed account email has been configured yet. Set ALLOWED_USER_EMAILS in both the app host and the Convex deployment, then sign in again.'
      }
      tone="warning"
      action={
        <Button
          variant="outlined"
          onClick={() => {
            void signOut({ returnTo: '/' })
          }}
          sx={{
            alignSelf: 'flex-start',
            borderRadius: 999,
            textTransform: 'none',
          }}
        >
          Sign out
        </Button>
      }
    />
  )
}

function CenteredState({
  action,
  body,
  isLoading = false,
  title,
  tone = 'info',
}: {
  action?: React.ReactNode
  body: string
  isLoading?: boolean
  title: string
  tone?: 'error' | 'info' | 'warning'
}) {
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
          px: 2,
          py: 4,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            borderRadius: 6,
            p: 3,
            bgcolor: 'rgba(255, 252, 245, 0.88)',
            border: '1px solid rgba(63, 45, 25, 0.08)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 60px rgba(86, 62, 29, 0.08)',
          }}
        >
          <Stack spacing={2}>
            {isLoading ? (
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center' }}
              >
                <CircularProgress size={18} sx={{ color: '#2f7d57' }} />
                <Typography sx={{ color: '#5a4a36' }}>{body}</Typography>
              </Stack>
            ) : (
              <Alert severity={tone}>
                <Stack spacing={1}>
                  <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {body}
                  </Typography>
                </Stack>
              </Alert>
            )}
            {!isLoading ? action : null}
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
