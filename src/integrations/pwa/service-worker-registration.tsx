import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      !import.meta.env.PROD ||
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return
    }

    void navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })
  }, [])

  return null
}
