import { describe, expect, it } from 'vitest'
import {
  isAllowedUserEmail,
  normalizeEmail,
  parseAllowedUserEmails,
} from './access-control'

describe('access control helpers', () => {
  it('normalizes emails for allowlist comparisons', () => {
    expect(normalizeEmail('  User@example.com ')).toBe('user@example.com')
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })

  it('parses a comma-separated allowlist', () => {
    expect(
      parseAllowedUserEmails(
        ' User@example.com, admin@example.com ,user@example.com ',
      ),
    ).toEqual(['user@example.com', 'admin@example.com'])
  })

  it('matches emails against the normalized allowlist', () => {
    const allowedEmails = parseAllowedUserEmails(
      'owner@example.com, backup@example.com',
    )

    expect(isAllowedUserEmail('OWNER@example.com', allowedEmails)).toBe(true)
    expect(isAllowedUserEmail('guest@example.com', allowedEmails)).toBe(false)
    expect(isAllowedUserEmail(null, allowedEmails)).toBe(false)
  })
})
