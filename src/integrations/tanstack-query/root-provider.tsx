import type { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient } from '@tanstack/react-query'
import {
  convexQueryClient as browserConvexQueryClient,
  createConvexQueryClient,
} from '../convex/provider'

export interface AppRouterContext {
  convexQueryClient: ConvexQueryClient | null
  queryClient: QueryClient
}

let browserQueryClient: QueryClient | null = null

export function getRouterContext(): AppRouterContext {
  return {
    convexQueryClient:
      typeof window === 'undefined'
        ? createConvexQueryClient()
        : browserConvexQueryClient,
    queryClient: getQueryClient(),
  }
}

function getQueryClient() {
  if (typeof window === 'undefined') {
    return new QueryClient()
  }

  if (!browserQueryClient) {
    browserQueryClient = new QueryClient()
  }

  return browserQueryClient
}
