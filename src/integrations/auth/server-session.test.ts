import { describe, expect, it } from 'vitest'
import { createServerSessionState } from './server-session'

describe('createServerSessionState', () => {
  it('returns an authenticated session when a user and token are present', () => {
    expect(
      createServerSessionState({
        accessToken: 'token-123',
        user: { id: 'user_123' },
      }),
    ).toEqual({
      isAuthenticated: true,
      token: 'token-123',
      userId: 'user_123',
    })
  })

  it('returns an anonymous session when there is no user', () => {
    expect(
      createServerSessionState({
        accessToken: 'token-123',
        user: null,
      }),
    ).toEqual({
      isAuthenticated: false,
      token: null,
      userId: null,
    })
  })
})
