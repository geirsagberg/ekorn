import { ConvexHttpClient } from 'convex/browser'

const bundledViteConvexUrl = import.meta.env?.VITE_CONVEX_URL

export function resolveServerConvexUrl() {
  return resolveServerConvexUrlFromEnvironment({
    CONVEX_URL: process.env.CONVEX_URL,
    VITE_CONVEX_URL: process.env.VITE_CONVEX_URL,
    bundledViteConvexUrl,
  })
}

export function createServerConvexHttpClient() {
  const convexUrl = resolveServerConvexUrl()

  if (!convexUrl) {
    return null
  }

  return new ConvexHttpClient(convexUrl, { logger: false })
}

export function resolveServerConvexUrlFromEnvironment(environment: {
  CONVEX_URL?: string
  VITE_CONVEX_URL?: string
  bundledViteConvexUrl?: string
}) {
  return (
    normalizeEnvironmentValue(environment.CONVEX_URL) ??
    normalizeEnvironmentValue(environment.VITE_CONVEX_URL) ??
    normalizeEnvironmentValue(environment.bundledViteConvexUrl) ??
    null
  )
}

function normalizeEnvironmentValue(value: string | undefined) {
  const normalized =
    value
      ?.trim()
      .replace(/^['"]+|['"]+$/g, '')
      .trim() ?? ''

  return normalized.length > 0 ? normalized : null
}
