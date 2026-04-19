import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { ServerSessionState } from '../auth/server-session'

export function syncServerSessionToConvexQueryClient(
  convexQueryClient: ConvexQueryClient | null,
  session: ServerSessionState,
) {
  const serverHttpClient = convexQueryClient?.serverHttpClient

  if (!serverHttpClient) {
    return
  }

  if (session.token) {
    serverHttpClient.setAuth(session.token)
    return
  }

  serverHttpClient.clearAuth()
}
