import { ConvexHttpClient } from 'convex/browser'

export function resolveServerConvexUrl() {
  return (
    readEnvironmentValue('CONVEX_URL') ??
    readEnvironmentValue('VITE_CONVEX_URL') ??
    null
  )
}

export function createServerConvexHttpClient() {
  const convexUrl = resolveServerConvexUrl()

  if (!convexUrl) {
    return null
  }

  return new ConvexHttpClient(convexUrl, { logger: false })
}

function readEnvironmentValue(name: string) {
  const viteEnv = import.meta.env as Record<string, string | undefined>

  return process.env[name] ?? viteEnv[name]
}
