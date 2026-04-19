import {
  DEFAULT_CATEGORY_PERSISTENCE_THRESHOLD,
  DEFAULT_CATEGORY_REPLACEMENT_DELTA,
  STARTER_CATEGORY_PATHS,
} from './taxonomy'
import {
  createReceiptLabelKey,
  normalizeCategoryName,
  normalizeReceiptLabel,
  slugifyCategoryName,
} from './text'

type MappingSource = 'ai' | 'admin'

interface ReceiptTagRecord {
  id: string
  name: string
  slug: string
  parentTagId: string | null
  isSystemGenerated: boolean
}

interface RawMappingRecord {
  rawLabelKey: string
  rawLabel: string
  normalizedLabel: string
  confidence: number
  source: MappingSource
}

interface NormalizedMappingRecord {
  normalizedLabelKey: string
  normalizedLabel: string
  tagIds: string[]
  confidence: number
  source: MappingSource
}

export interface ReceiptCategorizationRawMapping {
  rawLabelKey: string
  rawLabel: string
  normalizedLabel: string
  confidence: number
  source: MappingSource
}

export interface ReceiptCategorizationNormalizedMapping {
  normalizedLabelKey: string
  normalizedLabel: string
  categories: string[]
  confidence: number
  source: MappingSource
}

export interface PersistAiSuggestionInput {
  rawLabelKey: string
  rawLabel: string
  normalizedLabelKey: string
  normalizedLabel: string
  categories: string[]
  confidence: number
}

export interface PersistAiSuggestionResult {
  categories: string[]
  confidence: number
  source: MappingSource
}

export interface ReceiptCategorizationRepository {
  ensureStarterTaxonomy(): Promise<void>
  getRawMappings(
    rawLabelKeys: string[],
  ): Promise<Map<string, ReceiptCategorizationRawMapping>>
  getNormalizedMappings(
    normalizedLabelKeys: string[],
  ): Promise<Map<string, ReceiptCategorizationNormalizedMapping>>
  listTaxonomyPaths(): Promise<string[][]>
  persistAiSuggestion(
    input: PersistAiSuggestionInput,
  ): Promise<PersistAiSuggestionResult>
}

export function createInMemoryReceiptCategorizationRepository() {
  return new MemoryReceiptCategorizationRepository()
}

export class MemoryReceiptCategorizationRepository
  implements ReceiptCategorizationRepository
{
  private nextId = 1
  private readonly tags: ReceiptTagRecord[] = []
  private readonly rawMappings: RawMappingRecord[] = []
  private readonly normalizedMappings: NormalizedMappingRecord[] = []

  async ensureStarterTaxonomy() {
    for (const path of STARTER_CATEGORY_PATHS) {
      this.ensureTagPath([...path], false)
    }
  }

  async getRawMappings(rawLabelKeys: string[]) {
    const results = new Map<string, ReceiptCategorizationRawMapping>()

    for (const rawLabelKey of new Set(rawLabelKeys)) {
      const mapping = selectPreferredMapping(
        this.rawMappings.filter((row) => row.rawLabelKey === rawLabelKey),
      )

      if (mapping) {
        results.set(rawLabelKey, { ...mapping })
      }
    }

    return results
  }

  async getNormalizedMappings(normalizedLabelKeys: string[]) {
    const results = new Map<string, ReceiptCategorizationNormalizedMapping>()

    for (const normalizedLabelKey of new Set(normalizedLabelKeys)) {
      const mapping = selectPreferredMapping(
        this.normalizedMappings.filter(
          (row) => row.normalizedLabelKey === normalizedLabelKey,
        ),
      )

      if (mapping) {
        results.set(normalizedLabelKey, {
          normalizedLabelKey: mapping.normalizedLabelKey,
          normalizedLabel: mapping.normalizedLabel,
          categories: this.resolveCategories(mapping.tagIds),
          confidence: mapping.confidence,
          source: mapping.source,
        })
      }
    }

    return results
  }

  async listTaxonomyPaths() {
    return this.buildTaxonomyPaths()
  }

  async persistAiSuggestion(input: PersistAiSuggestionInput) {
    const tagIds = this.ensureTagPath(input.categories, true)
    const normalizedMapping = this.upsertNormalizedMapping({
      normalizedLabelKey: input.normalizedLabelKey,
      normalizedLabel: normalizeReceiptLabel(input.normalizedLabel),
      tagIds,
      confidence: input.confidence,
      source: 'ai',
    })
    this.upsertRawMapping({
      rawLabelKey: input.rawLabelKey,
      rawLabel: input.rawLabel,
      normalizedLabel: normalizedMapping.normalizedLabel,
      confidence: input.confidence,
      source: 'ai',
    })

    return {
      categories: this.resolveCategories(normalizedMapping.tagIds),
      confidence: normalizedMapping.confidence,
      source: normalizedMapping.source,
    }
  }

  private buildTaxonomyPaths() {
    return this.tags
      .map((tag) => this.buildCategoryPath(tag.id))
      .filter((path) => path.length > 0)
  }

  private buildCategoryPath(tagId: string) {
    const segments: string[] = []
    let currentTagId: string | null = tagId

    while (currentTagId) {
      const tag = this.tags.find((candidate) => candidate.id === currentTagId)

      if (!tag) {
        break
      }

      segments.unshift(tag.name)
      currentTagId = tag.parentTagId
    }

    return segments
  }

  private ensureTagPath(categoryPath: string[], isSystemGenerated: boolean) {
    let parentTagId: string | null = null
    const tagIds: string[] = []

    for (const rawName of categoryPath) {
      const name = normalizeCategoryName(rawName)

      if (!name) {
        continue
      }

      const slug = slugifyCategoryName(name)
      let tag = this.tags.find(
        (candidate) =>
          candidate.parentTagId === parentTagId && candidate.slug === slug,
      )

      if (!tag) {
        tag = {
          id: `tag-${this.nextId++}`,
          name,
          slug,
          parentTagId,
          isSystemGenerated,
        }
        this.tags.push(tag)
      }

      tagIds.push(tag.id)
      parentTagId = tag.id
    }

    return tagIds
  }

  private upsertRawMapping(nextMapping: RawMappingRecord) {
    const existing = selectPreferredMapping(
      this.rawMappings.filter(
        (row) => row.rawLabelKey === nextMapping.rawLabelKey,
      ),
    )

    if (!existing) {
      this.rawMappings.push(nextMapping)
      return nextMapping
    }

    if (!shouldReplaceAiMapping(existing, nextMapping)) {
      return existing
    }

    Object.assign(existing, nextMapping)
    return existing
  }

  private upsertNormalizedMapping(nextMapping: NormalizedMappingRecord) {
    const existing = selectPreferredMapping(
      this.normalizedMappings.filter(
        (row) => row.normalizedLabelKey === nextMapping.normalizedLabelKey,
      ),
    )

    if (!existing) {
      this.normalizedMappings.push(nextMapping)
      return nextMapping
    }

    if (!shouldReplaceAiMapping(existing, nextMapping)) {
      return existing
    }

    Object.assign(existing, nextMapping)
    return existing
  }

  private resolveCategories(tagIds: string[]) {
    return tagIds
      .map((tagId) => this.tags.find((tag) => tag.id === tagId)?.name ?? null)
      .filter((name): name is string => name !== null)
  }
}

export function getSharedInMemoryReceiptCategorizationRepository() {
  const globalStore = globalThis as typeof globalThis & {
    __ekornReceiptCategorizationRepository?:
      | MemoryReceiptCategorizationRepository
      | undefined
  }

  if (!globalStore.__ekornReceiptCategorizationRepository) {
    globalStore.__ekornReceiptCategorizationRepository =
      new MemoryReceiptCategorizationRepository()
  }

  return globalStore.__ekornReceiptCategorizationRepository
}

function selectPreferredMapping<
  T extends { source: MappingSource; confidence: number },
>(mappings: T[]) {
  return [...mappings].sort(compareMappings)[0] ?? null
}

function compareMappings(
  left: { source: MappingSource; confidence: number },
  right: { source: MappingSource; confidence: number },
) {
  if (left.source !== right.source) {
    return left.source === 'admin' ? -1 : 1
  }

  return right.confidence - left.confidence
}

function shouldReplaceAiMapping(
  existing: { source: MappingSource; confidence: number },
  nextMapping: { source: MappingSource; confidence: number },
) {
  if (existing.source === 'admin') {
    return false
  }

  if (nextMapping.confidence < DEFAULT_CATEGORY_PERSISTENCE_THRESHOLD) {
    return false
  }

  if (nextMapping.source === 'admin') {
    return true
  }

  return (
    nextMapping.confidence >
    existing.confidence + DEFAULT_CATEGORY_REPLACEMENT_DELTA
  )
}

export function createNormalizedLabelKey(normalizedLabel: string) {
  return createReceiptLabelKey(normalizedLabel)
}
