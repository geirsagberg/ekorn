import { describe, expect, it } from 'vitest'
import { resolveLocalAuthBypassEnabled } from './local-bypass'

describe('resolveLocalAuthBypassEnabled', () => {
  it('enables the bypass only in development runtimes', () => {
    expect(
      resolveLocalAuthBypassEnabled({
        envFlag: '1',
        isDevelopmentRuntime: true,
      }),
    ).toBe(true)

    expect(
      resolveLocalAuthBypassEnabled({
        envFlag: '1',
        isDevelopmentRuntime: false,
      }),
    ).toBe(false)
  })

  it('accepts either LOCAL_AUTH_BYPASS or VITE_LOCAL_AUTH_BYPASS values', () => {
    expect(
      resolveLocalAuthBypassEnabled({
        envFlag: 'true',
        isDevelopmentRuntime: true,
      }),
    ).toBe(true)

    expect(
      resolveLocalAuthBypassEnabled({
        viteEnvFlag: '1',
        isDevelopmentRuntime: true,
      }),
    ).toBe(true)
  })

  it('ignores blank or unsupported values', () => {
    expect(
      resolveLocalAuthBypassEnabled({
        envFlag: '  ',
        isDevelopmentRuntime: true,
      }),
    ).toBe(false)

    expect(
      resolveLocalAuthBypassEnabled({
        envFlag: 'nope',
        isDevelopmentRuntime: true,
      }),
    ).toBe(false)
  })
})
