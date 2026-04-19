import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PwaInstallPrompt } from './install-prompt'

describe('PwaInstallPrompt', () => {
  beforeEach(() => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
    )
    stubMatchMedia(false)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows Android fallback instructions before the native install event is available', () => {
    render(<PwaInstallPrompt />)

    expect(
      screen.getByText(/open the menu and tap Install app or Add to/i),
    ).toBeTruthy()
  })

  it('uses the native install prompt when Chrome exposes it', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    const nativePromptEvent = createBeforeInstallPromptEvent({
      prompt,
      outcome: 'accepted',
    })

    render(<PwaInstallPrompt />)
    window.dispatchEvent(nativePromptEvent)

    fireEvent.click(await screen.findByRole('button', { name: 'Install' }))

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(
        screen.queryByText(/Install Ekorn on your Android home screen/i),
      ).toBeNull()
    })
  })
})

function createBeforeInstallPromptEvent({
  outcome,
  prompt,
}: {
  outcome: 'accepted' | 'dismissed'
  prompt: () => Promise<void>
}) {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
    preventDefault: () => void
  }

  event.prompt = prompt
  event.userChoice = Promise.resolve({
    outcome,
    platform: 'web',
  })

  return event
}

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  })
}

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}
