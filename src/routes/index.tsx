import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <Box component="main" sx={{ minHeight: '100dvh' }}>
      <Container
        maxWidth="sm"
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack spacing={2} sx={{ width: '100%' }}>
          <Typography>
            Add a receipt photo from the camera or gallery.
          </Typography>
          <Button type="button" variant="contained">
            Add photo
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
