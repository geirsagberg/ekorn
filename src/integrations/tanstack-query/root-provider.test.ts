import { describe, expect, it } from 'vitest'
import { getRouterContext } from './root-provider'

describe('getRouterContext', () => {
  it('reuses the browser query and Convex clients across calls', () => {
    const firstContext = getRouterContext()
    const secondContext = getRouterContext()

    expect(secondContext.queryClient).toBe(firstContext.queryClient)
    expect(secondContext.convexQueryClient).toBe(firstContext.convexQueryClient)
  })
})
