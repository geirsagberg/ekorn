import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../convex/_generated/api'
import type {
  PersistAiSuggestionInput,
  PersistAiSuggestionResult,
  ReceiptCategorizationNormalizedMapping,
  ReceiptCategorizationRawMapping,
  ReceiptCategorizationRepository,
} from './repository'

export function createConvexReceiptCategorizationRepository(
  client: ConvexHttpClient,
): ReceiptCategorizationRepository {
  return {
    async ensureStarterTaxonomy() {
      await client.mutation(api.categorization.ensureStarterTaxonomy, {})
    },
    async getRawMappings(rawLabelKeys: string[]) {
      const uniqueKeys = [...new Set(rawLabelKeys)]

      if (uniqueKeys.length === 0) {
        return new Map()
      }

      const rows = await client.query(api.categorization.getRawMappings, {
        rawLabelKeys: uniqueKeys,
      })

      return new Map(
        rows.map((row: ReceiptCategorizationRawMapping) => [
          row.rawLabelKey,
          row,
        ]),
      )
    },
    async getNormalizedMappings(normalizedLabelKeys: string[]) {
      const uniqueKeys = [...new Set(normalizedLabelKeys)]

      if (uniqueKeys.length === 0) {
        return new Map()
      }

      const rows = await client.query(
        api.categorization.getNormalizedMappings,
        {
          normalizedLabelKeys: uniqueKeys,
        },
      )

      return new Map(
        rows.map((row: ReceiptCategorizationNormalizedMapping) => [
          row.normalizedLabelKey,
          row,
        ]),
      )
    },
    async listTaxonomyPaths() {
      return await client.query(api.categorization.listTaxonomyPaths, {})
    },
    async persistAiSuggestion(input: PersistAiSuggestionInput) {
      return (await client.mutation(api.categorization.persistAiSuggestion, {
        ...input,
      })) as PersistAiSuggestionResult
    },
  }
}
