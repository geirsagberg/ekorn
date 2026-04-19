export function isLocalAuthBypassEnabled() {
  return resolveLocalAuthBypassEnabled({
    envFlag: readEnvironmentValue('LOCAL_AUTH_BYPASS'),
    viteEnvFlag: readEnvironmentValue('VITE_LOCAL_AUTH_BYPASS'),
    isDevelopmentRuntime: isDevelopmentRuntime(),
  })
}

export function resolveLocalAuthBypassEnabled(input: {
  envFlag?: string | null
  viteEnvFlag?: string | null
  isDevelopmentRuntime: boolean
}) {
  if (!input.isDevelopmentRuntime) {
    return false
  }

  const normalizedFlag = normalizeFlag(input.envFlag ?? input.viteEnvFlag)

  return normalizedFlag === '1' || normalizedFlag === 'true'
}

function isDevelopmentRuntime() {
  const viteEnv = import.meta.env as Record<string, unknown>

  if (typeof viteEnv.DEV === 'boolean') {
    return viteEnv.DEV
  }

  return process.env.NODE_ENV !== 'production'
}

function readEnvironmentValue(name: string) {
  const viteEnv = import.meta.env as Record<string, string | undefined>

  return process.env[name] ?? viteEnv[name]
}

function normalizeFlag(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}
