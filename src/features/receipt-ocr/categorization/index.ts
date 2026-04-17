import type { ReceiptOcrPreviewResult } from '../shared'
import { createOpenAiReceiptCategorizer } from './openai'
import { createReceiptCategorizationRepository } from './repository'
import { categorizeReceiptPreview } from './service'

export async function categorizeReceiptPreviewResult(
  previewResult: ReceiptOcrPreviewResult,
) {
  return categorizeReceiptPreview({
    previewResult,
    repository: createReceiptCategorizationRepository(),
    ai: createOpenAiReceiptCategorizer(),
  })
}
