import { useAction, useConvexAuth } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'

export function useStoreCurrentUserEffect() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const storeCurrentUser = useAction(api.users.syncCurrent)
  const [hasStoredUser, setHasStoredUser] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      setHasStoredUser(false)
      setError(null)
      return
    }

    let isActive = true

    void storeCurrentUser()
      .then(() => {
        if (isActive) {
          setHasStoredUser(true)
          setError(null)
        }
      })
      .catch((nextError: unknown) => {
        if (isActive) {
          setHasStoredUser(false)
          setError(
            nextError instanceof Error
              ? nextError.message
              : 'Could not finish loading your account.',
          )
        }
      })

    return () => {
      isActive = false
      setHasStoredUser(false)
    }
  }, [isAuthenticated, isLoading, storeCurrentUser])

  return {
    error,
    isLoading: isLoading || (isAuthenticated && !hasStoredUser),
  }
}
