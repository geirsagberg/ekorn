import { describe, expect, it, vi } from 'vitest'
import { syncServerSessionToConvexQueryClient } from './server-auth'

describe('syncServerSessionToConvexQueryClient', () => {
  it('sets auth when the session is authenticated', () => {
    const setAuth = vi.fn()
    const clearAuth = vi.fn()

    syncServerSessionToConvexQueryClient(
      {
        serverHttpClient: {
          clearAuth,
          setAuth,
        },
      } as never,
      {
        isAuthenticated: true,
        token: 'token-123',
        userId: 'user_123',
      },
    )

    expect(setAuth).toHaveBeenCalledWith('token-123')
    expect(clearAuth).not.toHaveBeenCalled()
  })

  it('clears auth when the session is anonymous', () => {
    const setAuth = vi.fn()
    const clearAuth = vi.fn()

    syncServerSessionToConvexQueryClient(
      {
        serverHttpClient: {
          clearAuth,
          setAuth,
        },
      } as never,
      {
        isAuthenticated: false,
        token: null,
        userId: null,
      },
    )

    expect(clearAuth).toHaveBeenCalledTimes(1)
    expect(setAuth).not.toHaveBeenCalled()
  })
})
