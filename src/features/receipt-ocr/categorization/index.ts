import { createServerConvexHttpClient } from '#/integrations/convex/server-http-client'
import type { ReceiptOcrPreviewResult } from '../shared'
import { createConvexReceiptCategorizationRepository } from './convex-repository'
import { createOpenAiReceiptCategorizer } from './openai'
import { getSharedInMemoryReceiptCategorizationRepository } from './repository'
import { categorizeReceiptPreview } from './service'

export async function categorizeReceiptPreviewResult(
  previewResult: ReceiptOcrPreviewResult,
) {
  const convexClient = createServerConvexHttpClient()

  return categorizeReceiptPreview({
    previewResult,
    repository: convexClient
      ? createConvexReceiptCategorizationRepository(convexClient)
      : getSharedInMemoryReceiptCategorizationRepository(),
    ai: createOpenAiReceiptCategorizer(),
  })
}
