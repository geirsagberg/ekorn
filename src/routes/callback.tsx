import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { handleCallbackRoute } from '@workos/authkit-tanstack-react-start'
import { useEffect } from 'react'

export const Route = createFileRoute('/callback')({
  component: CallbackScreen,
  server: {
    handlers: {
      GET: handleCallbackRoute(),
    },
  },
})

function CallbackScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    void navigate({
      to: '/',
      replace: true,
    })
  }, [navigate])

  return (
    <Stack
      spacing={1.5}
      sx={{
        minHeight: '100dvh',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#5a4a36',
      }}
    >
      <CircularProgress size={20} sx={{ color: '#2f7d57' }} />
      <Typography>Finishing sign-in...</Typography>
    </Stack>
  )
}
