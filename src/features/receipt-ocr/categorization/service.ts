import { logReceiptDebug } from '../debug'
import type {
  ReceiptItemCategorizationSource,
  ReceiptOcrPreviewResult,
} from '../shared'
import {
  createNormalizedLabelKey,
  type ReceiptCategorizationRepository,
} from './repository'
import {
  DEFAULT_CATEGORY_DISPLAY_THRESHOLD,
  DEFAULT_CATEGORY_PERSISTENCE_THRESHOLD,
  STARTER_CATEGORY_PATHS,
} from './taxonomy'
import {
  createReceiptLabelKey,
  normalizeCategoryName,
  normalizeReceiptLabel,
} from './text'

export interface CategorizationAiItemInput {
  rawLabel: string
  normalizedCandidate: string
  amount: number | null
  currency: string | null
}

export interface CategorizationAiSuggestion {
  itemIndex: number
  normalizedLabel: string
  categories: string[]
  confidence: number
  source: Extract<ReceiptItemCategorizationSource, 'ai_existing' | 'ai_new'>
}

export interface CategorizationAi {
  categorizeItems(input: {
    items: CategorizationAiItemInput[]
    taxonomyPaths: string[][]
  }): Promise<CategorizationAiSuggestion[]>
}

interface CategorizeReceiptPreviewOptions {
  previewResult: ReceiptOcrPreviewResult
  repository: ReceiptCategorizationRepository
  ai: CategorizationAi
}

export async function categorizeReceiptPreview({
  previewResult,
  repository,
  ai,
}: CategorizeReceiptPreviewOptions): Promise<ReceiptOcrPreviewResult> {
  if (previewResult.items.length === 0) {
    return previewResult
  }

  await repository.ensureStarterTaxonomy()

  const indexedItems = previewResult.items.map((item, itemIndex) => ({
    item,
    itemIndex,
    rawLabelKey: createReceiptLabelKey(item.text),
    normalizedCandidate: normalizeReceiptLabel(item.text),
  }))
  const rawMappings = await repository.getRawMappings(
    indexedItems.map((item) => item.rawLabelKey),
  )
  const normalizedKeys = [
    ...indexedItems.map((item) =>
      createNormalizedLabelKey(item.normalizedCandidate),
    ),
    ...[...rawMappings.values()].map((mapping) =>
      createNormalizedLabelKey(mapping.normalizedLabel),
    ),
  ]
  const normalizedMappings =
    await repository.getNormalizedMappings(normalizedKeys)
  const items = [...previewResult.items]
  const misses: Array<{
    itemIndex: number
    rawLabelKey: string
    normalizedCandidate: string
  }> = []

  for (const indexedItem of indexedItems) {
    const rawMapping = rawMappings.get(indexedItem.rawLabelKey)
    const rawResolvedMapping = rawMapping
      ? normalizedMappings.get(
          createNormalizedLabelKey(rawMapping.normalizedLabel),
        )
      : null

    if (rawResolvedMapping) {
      logCategorizationDecision({
        categories: rawResolvedMapping.categories,
        confidence: rawResolvedMapping.confidence,
        itemText: indexedItem.item.text,
        normalizedLabel: rawResolvedMapping.normalizedLabel,
        source: 'raw_cache',
        usedStoredCategorization: true,
      })
      items[indexedItem.itemIndex] = buildCategorizedItem(
        indexedItem.item,
        rawResolvedMapping.categories,
        rawResolvedMapping.confidence,
        'raw_cache',
      )
      continue
    }

    const normalizedMapping = normalizedMappings.get(
      createNormalizedLabelKey(indexedItem.normalizedCandidate),
    )

    if (normalizedMapping) {
      logCategorizationDecision({
        categories: normalizedMapping.categories,
        confidence: normalizedMapping.confidence,
        itemText: indexedItem.item.text,
        normalizedLabel: normalizedMapping.normalizedLabel,
        source: 'normalized_cache',
        usedStoredCategorization: true,
      })
      items[indexedItem.itemIndex] = buildCategorizedItem(
        indexedItem.item,
        normalizedMapping.categories,
        normalizedMapping.confidence,
        'normalized_cache',
      )
      continue
    }

    misses.push({
      itemIndex: indexedItem.itemIndex,
      rawLabelKey: indexedItem.rawLabelKey,
      normalizedCandidate: indexedItem.normalizedCandidate,
    })
    logCategorizationDecision({
      itemText: indexedItem.item.text,
      normalizedLabel: indexedItem.normalizedCandidate,
      source: 'miss',
      usedStoredCategorization: false,
    })
  }

  if (misses.length === 0) {
    return {
      ...previewResult,
      items,
    }
  }

  const taxonomyPaths = await repository.listTaxonomyPaths()
  const aiSuggestions = await ai.categorizeItems({
    items: misses.map((miss) => ({
      rawLabel: indexedItems[miss.itemIndex]?.item.text ?? '',
      normalizedCandidate: miss.normalizedCandidate,
      amount: indexedItems[miss.itemIndex]?.item.amount ?? null,
      currency: previewResult.currency,
    })),
    taxonomyPaths: taxonomyPaths.length > 0 ? taxonomyPaths : starterPaths(),
  })
  const aiSuggestionsByIndex = new Map(
    aiSuggestions.map((suggestion) => [
      misses[suggestion.itemIndex]?.itemIndex,
      suggestion,
    ]),
  )

  for (const miss of misses) {
    const item = indexedItems[miss.itemIndex]?.item
    const suggestion = aiSuggestionsByIndex.get(miss.itemIndex)

    if (!item || !suggestion) {
      if (item) {
        logCategorizationDecision({
          itemText: item.text,
          normalizedLabel: miss.normalizedCandidate,
          source: 'no_suggestion',
          usedStoredCategorization: false,
        })
      }
      continue
    }

    const categories = suggestion.categories
      .map((category) => normalizeCategoryName(category))
      .filter((category) => category.length > 0)

    if (categories.length === 0) {
      logCategorizationDecision({
        itemText: item.text,
        normalizedLabel: suggestion.normalizedLabel,
        source: 'empty_categories',
        usedStoredCategorization: false,
      })
      continue
    }

    if (suggestion.confidence >= DEFAULT_CATEGORY_PERSISTENCE_THRESHOLD) {
      const persisted = await repository.persistAiSuggestion({
        rawLabelKey: miss.rawLabelKey,
        rawLabel: item.text,
        normalizedLabelKey: createNormalizedLabelKey(
          suggestion.normalizedLabel,
        ),
        normalizedLabel: suggestion.normalizedLabel,
        categories,
        confidence: suggestion.confidence,
      })

      logCategorizationDecision({
        categories: persisted.categories,
        confidence: persisted.confidence,
        itemText: item.text,
        normalizedLabel: suggestion.normalizedLabel,
        persisted: true,
        source: suggestion.source,
        usedStoredCategorization: false,
      })
      items[miss.itemIndex] = buildCategorizedItem(
        item,
        persisted.categories,
        persisted.confidence,
        suggestion.source,
      )
      continue
    }

    if (suggestion.confidence >= DEFAULT_CATEGORY_DISPLAY_THRESHOLD) {
      logCategorizationDecision({
        categories,
        confidence: suggestion.confidence,
        itemText: item.text,
        normalizedLabel: suggestion.normalizedLabel,
        persisted: false,
        source: suggestion.source,
        usedStoredCategorization: false,
      })
      items[miss.itemIndex] = buildCategorizedItem(
        item,
        categories,
        suggestion.confidence,
        suggestion.source,
      )
    }
  }

  return {
    ...previewResult,
    items,
  }
}

function logCategorizationDecision(details: Record<string, unknown>) {
  logReceiptDebug('categorization', {
    event: 'categorization_decision',
    ...details,
  })
}

function buildCategorizedItem(
  item: ReceiptOcrPreviewResult['items'][number],
  categories: string[],
  confidence: number,
  source: ReceiptItemCategorizationSource,
) {
  return {
    ...item,
    categories,
    categorizationConfidence: roundConfidence(confidence),
    categorizationSource: source,
    isLowConfidence:
      source !== 'raw_cache' &&
      source !== 'normalized_cache' &&
      confidence < DEFAULT_CATEGORY_PERSISTENCE_THRESHOLD,
  }
}

function roundConfidence(value: number) {
  return Math.round(value * 100) / 100
}

function starterPaths() {
  return STARTER_CATEGORY_PATHS.map((path) => [...path])
}
