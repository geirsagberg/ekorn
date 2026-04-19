import { QueryClient } from '@tanstack/react-query'
import { convexQueryClient } from '../convex/provider'

export function getContext() {
  return {
    convexQueryClient,
    queryClient: new QueryClient(),
  }
}
