import { describe, expect, it } from 'vitest'
import {
  authPolicyMessages,
  getAccessPolicy,
  requireAllowlistedEmail,
  requireAuthenticatedValue,
  resolveAllowedUserEmails,
} from './server-access-policy'

describe('server access policy', () => {
  it('resolves the normalized allowlist from environment-style input', () => {
    expect(
      resolveAllowedUserEmails(
        ' User@example.com, admin@example.com ,user@example.com ',
      ),
    ).toEqual(['user@example.com', 'admin@example.com'])
  })

  it('reports whether the allowlist is configured and matched', () => {
    expect(
      getAccessPolicy(
        'OWNER@example.com',
        'owner@example.com,backup@example.com',
      ),
    ).toEqual({
      allowedEmails: ['owner@example.com', 'backup@example.com'],
      allowlistConfigured: true,
      isAllowed: true,
    })

    expect(getAccessPolicy('guest@example.com', null)).toEqual({
      allowedEmails: [],
      allowlistConfigured: false,
      isAllowed: false,
    })
  })

  it('requires an authenticated value before continuing', () => {
    expect(() => requireAuthenticatedValue(null)).toThrow(
      authPolicyMessages.notAuthenticated,
    )
    expect(requireAuthenticatedValue({ id: 'user_123' })).toEqual({
      id: 'user_123',
    })
  })

  it('requires an allowlisted email with a configurable user-safe error', () => {
    expect(() =>
      requireAllowlistedEmail('guest@example.com', {
        allowedUserEmailsValue: 'owner@example.com',
        notAllowedMessage: authPolicyMessages.receiptProcessingNotAllowed,
      }),
    ).toThrow(authPolicyMessages.receiptProcessingNotAllowed)

    expect(
      requireAllowlistedEmail('owner@example.com', {
        allowedUserEmailsValue: 'owner@example.com',
      }),
    ).toEqual({
      allowedEmails: ['owner@example.com'],
      allowlistConfigured: true,
      isAllowed: true,
    })
  })
})
