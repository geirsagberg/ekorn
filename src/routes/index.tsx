import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({ component: App })

interface SelectedPhoto {
  fileName: string
  fileSizeLabel: string
  previewUrl: string
}

function App() {
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (selectedPhoto) {
        URL.revokeObjectURL(selectedPhoto.previewUrl)
      }
    }
  }, [selectedPhoto])

  const handlePhotoSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Choose an image file from your camera or photo library.')
      return
    }

    setErrorMessage(null)
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
            <Stack spacing={1.5}>
              <Typography
                variant="overline"
                sx={{ color: '#7c6241', letterSpacing: '0.16em' }}
              >
                Receipt Capture
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: '#2f2417',
                }}
              >
                Add a receipt photo before it disappears into your bag.
              </Typography>
              <Typography sx={{ color: '#5a4a36' }}>
                Use your camera on the spot or pick an existing image from your
                gallery.
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
                accept="image/*"
                capture="environment"
                type="file"
                onChange={handlePhotoSelection}
              />
            </Button>

            <Typography variant="body2" sx={{ color: '#6f5c43' }}>
              Your browser decides whether to open the camera, the photo
              library, or both.
            </Typography>

            {errorMessage ? (
              <Alert severity="error">{errorMessage}</Alert>
            ) : null}

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
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, color: '#2f2417' }}
                  >
                    Selected receipt
                  </Typography>
                  <Typography sx={{ color: '#5a4a36' }}>
                    {selectedPhoto.fileName}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#7c6241' }}>
                    {selectedPhoto.fileSizeLabel}
                  </Typography>
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}

function formatFileSize(fileSizeInBytes: number) {
  if (fileSizeInBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(fileSizeInBytes / 1024))} KB`
  }

  return `${(fileSizeInBytes / (1024 * 1024)).toFixed(1)} MB`
}
