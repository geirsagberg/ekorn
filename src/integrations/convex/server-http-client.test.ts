import { describe, expect, it } from 'vitest'
import {
  resolveServerConvexUrl,
  resolveServerConvexUrlFromEnvironment,
} from './server-http-client'

describe('resolveServerConvexUrl', () => {
  it('prefers CONVEX_URL when present', () => {
    expect(
      resolveServerConvexUrlFromEnvironment({
        CONVEX_URL: 'https://server.convex.cloud',
        VITE_CONVEX_URL: 'https://vite.convex.cloud',
        bundledViteConvexUrl: 'https://bundled.convex.cloud',
      }),
    ).toBe('https://server.convex.cloud')
  })

  it('falls back to VITE_CONVEX_URL when needed', () => {
    expect(
      resolveServerConvexUrlFromEnvironment({
        VITE_CONVEX_URL: 'https://vite.convex.cloud',
        bundledViteConvexUrl: 'https://bundled.convex.cloud',
      }),
    ).toBe('https://vite.convex.cloud')
  })

  it('falls back to the bundled Vite URL in server runtimes', () => {
    expect(
      resolveServerConvexUrlFromEnvironment({
        bundledViteConvexUrl: 'https://bundled.convex.cloud',
      }),
    ).toBe('https://bundled.convex.cloud')
  })

  it('treats blank and quoted URL values as unset or normalized', () => {
    expect(
      resolveServerConvexUrlFromEnvironment({
        CONVEX_URL: '  ',
        VITE_CONVEX_URL: '"https://vite.convex.cloud"',
      }),
    ).toBe('https://vite.convex.cloud')
  })

  it('returns null when no Convex URL is configured', () => {
    expect(resolveServerConvexUrlFromEnvironment({})).toBeNull()
  })

  it('reads the server runtime environment', () => {
    expect(
      resolveServerConvexUrlWithProcessEnvironment({
        CONVEX_URL: 'https://server.convex.cloud',
      }),
    ).toBe('https://server.convex.cloud')
  })
})

function resolveServerConvexUrlWithProcessEnvironment(
  environment: Record<string, string | undefined>,
) {
  const originalConvexUrl = process.env.CONVEX_URL
  const originalViteConvexUrl = process.env.VITE_CONVEX_URL

  if (environment.CONVEX_URL === undefined) {
    delete process.env.CONVEX_URL
  } else {
    process.env.CONVEX_URL = environment.CONVEX_URL
  }

  if (environment.VITE_CONVEX_URL === undefined) {
    delete process.env.VITE_CONVEX_URL
  } else {
    process.env.VITE_CONVEX_URL = environment.VITE_CONVEX_URL
  }

  try {
    return resolveServerConvexUrl()
  } finally {
    if (originalConvexUrl === undefined) {
      delete process.env.CONVEX_URL
    } else {
      process.env.CONVEX_URL = originalConvexUrl
    }

    if (originalViteConvexUrl === undefined) {
      delete process.env.VITE_CONVEX_URL
    } else {
      process.env.VITE_CONVEX_URL = originalViteConvexUrl
    }
  }
}
