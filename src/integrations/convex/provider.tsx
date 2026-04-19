import { ConvexQueryClient } from '@convex-dev/react-query'
import {
  AuthKitProvider,
  useAccessToken,
  useAuth,
} from '@workos/authkit-tanstack-react-start/client'
import { ConvexProviderWithAuth } from 'convex/react'
import { useCallback, useMemo } from 'react'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

export function createConvexQueryClient(url: string | null = CONVEX_URL) {
  return url ? new ConvexQueryClient(url) : null
}

export const convexQueryClient = createConvexQueryClient()

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthKitProvider>
      {convexQueryClient ? (
        <ConvexProviderWithAuth
          client={convexQueryClient.convexClient}
          useAuth={useAuthFromWorkOS}
        >
          {children}
        </ConvexProviderWithAuth>
      ) : (
        children
      )}
    </AuthKitProvider>
  )
}

function useAuthFromWorkOS() {
  const { user, loading } = useAuth()
  const { getAccessToken, refresh } = useAccessToken()
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        if (!user) {
          return null
        }

        if (forceRefreshToken) {
          return (await refresh()) ?? null
        }

        return (await getAccessToken()) ?? null
      } catch {
        return null
      }
    },
    [getAccessToken, refresh, user],
  )

  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: user !== null,
      fetchAccessToken,
    }),
    [fetchAccessToken, loading, user],
  )
}
