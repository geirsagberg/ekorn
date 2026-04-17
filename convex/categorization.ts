import { v } from 'convex/values'
import {
  DEFAULT_CATEGORY_PERSISTENCE_THRESHOLD,
  DEFAULT_CATEGORY_REPLACEMENT_DELTA,
  STARTER_CATEGORY_PATHS,
} from '../src/features/receipt-ocr/categorization/taxonomy'
import {
  normalizeCategoryName,
  normalizeReceiptLabel,
  slugifyCategoryName,
} from '../src/features/receipt-ocr/categorization/text'
import type { Doc, Id } from './_generated/dataModel'
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from './_generated/server'

export const getRawMappings = query({
  args: {
    rawLabelKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const mappings = await Promise.all(
      [...new Set(args.rawLabelKeys)].map(async (rawLabelKey) => {
        const rows = await ctx.db
          .query('rawItemMappings')
          .withIndex('by_raw_label_key', (q) =>
            q.eq('rawLabelKey', rawLabelKey),
          )
          .collect()
        const mapping = selectPreferredMapping(rows)

        if (!mapping) {
          return null
        }

        return {
          rawLabelKey: mapping.rawLabelKey,
          rawLabel: mapping.rawLabel,
          normalizedLabel: mapping.normalizedLabel,
          confidence: mapping.confidence,
          source: mapping.source,
        }
      }),
    )

    return mappings.filter((mapping) => mapping !== null)
  },
})

export const getNormalizedMappings = query({
  args: {
    normalizedLabelKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const mappings = await Promise.all(
      [...new Set(args.normalizedLabelKeys)].map(async (normalizedLabelKey) => {
        const rows = await ctx.db
          .query('itemTagConnections')
          .withIndex('by_normalized_label_key', (q) =>
            q.eq('normalizedLabelKey', normalizedLabelKey),
          )
          .collect()
        const mapping = selectPreferredMapping(rows)

        if (!mapping) {
          return null
        }

        return {
          normalizedLabelKey: mapping.normalizedLabelKey,
          normalizedLabel: mapping.normalizedLabel,
          categories: await resolveTagPath(ctx, mapping.tagIds),
          confidence: mapping.confidence,
          source: mapping.source,
        }
      }),
    )

    return mappings.filter((mapping) => mapping !== null)
  },
})

export const listTaxonomyPaths = query({
  args: {},
  handler: async (ctx) => {
    const tags = await ctx.db.query('tags').collect()

    return tags
      .map((tag) => buildTagPath(tags, tag))
      .filter((path) => path.length > 0)
  },
})

export const ensureStarterTaxonomy = mutation({
  args: {},
  handler: async (ctx) => {
    for (const path of STARTER_CATEGORY_PATHS) {
      await ensureTagPath(ctx, [...path], false)
    }

    return null
  },
})

export const persistAiSuggestion = mutation({
  args: {
    rawLabelKey: v.string(),
    rawLabel: v.string(),
    normalizedLabelKey: v.string(),
    normalizedLabel: v.string(),
    categories: v.array(v.string()),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const tagIds = await ensureTagPath(ctx, args.categories, true)
    const normalizedMapping = await upsertNormalizedMapping(ctx, {
      normalizedLabelKey: args.normalizedLabelKey,
      normalizedLabel: normalizeReceiptLabel(args.normalizedLabel),
      tagIds,
      confidence: args.confidence,
      source: 'ai',
    })

    await upsertRawMapping(ctx, {
      rawLabelKey: args.rawLabelKey,
      rawLabel: args.rawLabel,
      normalizedLabel: normalizedMapping.normalizedLabel,
      confidence: args.confidence,
      source: 'ai',
    })

    return {
      categories: await resolveTagPath(ctx, normalizedMapping.tagIds),
      confidence: normalizedMapping.confidence,
      source: normalizedMapping.source,
    }
  },
})

async function ensureTagPath(
  ctx: MutationCtx,
  rawPath: string[],
  isSystemGenerated: boolean,
) {
  let parentTagId: Id<'tags'> | undefined
  const tagIds: Id<'tags'>[] = []

  for (const rawName of rawPath) {
    const name = normalizeCategoryName(rawName)

    if (!name) {
      continue
    }

    const slug = slugifyCategoryName(name)
    const siblings = await ctx.db
      .query('tags')
      .withIndex('by_parent', (q) => q.eq('parentTagId', parentTagId))
      .collect()
    let tag = siblings.find((candidate) => candidate.slug === slug)

    if (!tag) {
      const tagId = await ctx.db.insert('tags', {
        name,
        slug,
        parentTagId,
        isSystemGenerated,
      })

      tag = {
        _id: tagId,
        _creationTime: Date.now(),
        name,
        slug,
        parentTagId,
        isSystemGenerated,
      }
    }

    tagIds.push(tag._id)
    parentTagId = tag._id
  }

  return tagIds
}

async function upsertRawMapping(
  ctx: MutationCtx,
  nextMapping: {
    rawLabelKey: string
    rawLabel: string
    normalizedLabel: string
    confidence: number
    source: 'ai'
  },
) {
  const rows = await ctx.db
    .query('rawItemMappings')
    .withIndex('by_raw_label_key', (q) =>
      q.eq('rawLabelKey', nextMapping.rawLabelKey),
    )
    .collect()
  const existing = selectPreferredMapping(rows)

  if (!existing) {
    await ctx.db.insert('rawItemMappings', nextMapping)
    return nextMapping
  }

  if (!shouldReplaceAiMapping(existing, nextMapping)) {
    return existing
  }

  await ctx.db.patch(existing._id, nextMapping)

  return {
    ...existing,
    ...nextMapping,
  }
}

async function upsertNormalizedMapping(
  ctx: MutationCtx,
  nextMapping: {
    normalizedLabelKey: string
    normalizedLabel: string
    tagIds: Id<'tags'>[]
    confidence: number
    source: 'ai'
  },
) {
  const rows = await ctx.db
    .query('itemTagConnections')
    .withIndex('by_normalized_label_key', (q) =>
      q.eq('normalizedLabelKey', nextMapping.normalizedLabelKey),
    )
    .collect()
  const existing = selectPreferredMapping(rows)

  if (!existing) {
    const id = await ctx.db.insert('itemTagConnections', nextMapping)

    return {
      _id: id,
      _creationTime: Date.now(),
      ...nextMapping,
    }
  }

  if (!shouldReplaceAiMapping(existing, nextMapping)) {
    return existing
  }

  await ctx.db.patch(existing._id, nextMapping)

  return {
    ...existing,
    ...nextMapping,
  }
}

async function resolveTagPath(
  ctx: QueryCtx | MutationCtx,
  tagIds: Id<'tags'>[],
) {
  const tags = await Promise.all(tagIds.map((tagId) => ctx.db.get(tagId)))

  return tags
    .map((tag) => tag?.name ?? null)
    .filter((name): name is string => name !== null)
}

function buildTagPath(tags: Doc<'tags'>[], tag: Doc<'tags'>) {
  const path: string[] = []
  let currentTag: Doc<'tags'> | undefined = tag

  while (currentTag) {
    path.unshift(currentTag.name)
    currentTag = currentTag.parentTagId
      ? tags.find((candidate) => candidate._id === currentTag?.parentTagId)
      : undefined
  }

  return path
}

function selectPreferredMapping<
  T extends {
    _id: Id<'rawItemMappings'> | Id<'itemTagConnections'>
    confidence: number
    source: 'ai' | 'admin'
  },
>(rows: T[]) {
  return [...rows].sort(compareMappings)[0] ?? null
}

function compareMappings(
  left: { source: 'ai' | 'admin'; confidence: number },
  right: { source: 'ai' | 'admin'; confidence: number },
) {
  if (left.source !== right.source) {
    return left.source === 'admin' ? -1 : 1
  }

  return right.confidence - left.confidence
}

function shouldReplaceAiMapping(
  existing: { confidence: number; source: 'ai' | 'admin' },
  nextMapping: { confidence: number; source: 'ai' | 'admin' },
) {
  if (existing.source === 'admin') {
    return false
  }

  if (nextMapping.source === 'admin') {
    return true
  }

  if (nextMapping.confidence < DEFAULT_CATEGORY_PERSISTENCE_THRESHOLD) {
    return false
  }

  return (
    nextMapping.confidence >
    existing.confidence + DEFAULT_CATEGORY_REPLACEMENT_DELTA
  )
}
