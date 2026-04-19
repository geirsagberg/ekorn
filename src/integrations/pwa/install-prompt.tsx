import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { useEffect, useMemo, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

export function PwaInstallPrompt({ isActive = true }: { isActive?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const isAndroidBrowser = useMemo(detectAndroidBrowser, [])
  const isStandalone = useMemo(detectStandaloneDisplayMode, [])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !isAndroidBrowser ||
      isStandalone ||
      isInstalled
    ) {
      return
    }

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [isAndroidBrowser, isInstalled, isStandalone])

  if (
    !isActive ||
    isDismissed ||
    isInstalled ||
    !isAndroidBrowser ||
    isStandalone
  ) {
    return null
  }

  if (deferredPrompt) {
    return (
      <Alert
        severity="success"
        action={
          <Stack direction="row" spacing={1}>
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                void handleInstallClick({
                  deferredPrompt,
                  onAccepted: () => {
                    setDeferredPrompt(null)
                    setIsInstalled(true)
                  },
                  onDismissed: () => {
                    setDeferredPrompt(null)
                  },
                })
              }}
            >
              Install
            </Button>
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setIsDismissed(true)
              }}
            >
              Later
            </Button>
          </Stack>
        }
        sx={{
          alignItems: 'center',
          borderRadius: 3,
        }}
      >
        Install Ekorn on your Android home screen for a faster full-screen
        launch back into receipt capture.
      </Alert>
    )
  }

  return (
    <Alert
      severity="info"
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => {
            setIsDismissed(true)
          }}
        >
          Later
        </Button>
      }
      sx={{
        alignItems: 'center',
        borderRadius: 3,
      }}
    >
      In your Android browser, open the menu and tap Install app or Add to Home
      screen to keep Ekorn one tap away.
    </Alert>
  )
}

async function handleInstallClick({
  deferredPrompt,
  onAccepted,
  onDismissed,
}: {
  deferredPrompt: BeforeInstallPromptEvent
  onAccepted: () => void
  onDismissed: () => void
}) {
  await deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice

  if (choice.outcome === 'accepted') {
    onAccepted()
    return
  }

  onDismissed()
}

function detectAndroidBrowser() {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /Android/i.test(navigator.userAgent)
}

function detectStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false
  }

  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorWithStandalone.standalone === true
  )
}
