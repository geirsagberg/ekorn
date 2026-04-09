import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProvider } from 'convex/react'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  if (!CONVEX_URL) {
    return <>{children}</>
  }

  const convexQueryClient = new ConvexQueryClient(CONVEX_URL)

  return (
    <ConvexProvider client={convexQueryClient.convexClient}>
      {children}
    </ConvexProvider>
  )
}
