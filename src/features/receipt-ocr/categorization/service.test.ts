import { describe, expect, it, vi } from 'vitest'
import type { ReceiptOcrPreviewResult } from '../shared'
import {
  createInMemoryReceiptCategorizationRepository,
  createNormalizedLabelKey,
} from './repository'
import { categorizeReceiptPreview } from './service'
import { createReceiptLabelKey } from './text'

describe('categorizeReceiptPreview', () => {
  it('prefers a raw cache hit over a normalized cache hit and AI', async () => {
    const repository = createInMemoryReceiptCategorizationRepository()
    await repository.ensureStarterTaxonomy()
    await repository.persistAiSuggestion({
      rawLabelKey: createReceiptLabelKey('Milk 1L'),
      rawLabel: 'Milk 1L',
      normalizedLabelKey: createNormalizedLabelKey('whole milk'),
      normalizedLabel: 'whole milk',
      categories: ['Food', 'Dairy'],
      confidence: 0.93,
    })
    await repository.persistAiSuggestion({
      rawLabelKey: createReceiptLabelKey('Shelf item'),
      rawLabel: 'Shelf item',
      normalizedLabelKey: createNormalizedLabelKey('milk 1l'),
      normalizedLabel: 'milk 1l',
      categories: ['Other'],
      confidence: 0.95,
    })
    const ai = {
      categorizeItems: vi.fn().mockResolvedValue([
        {
          itemIndex: 0,
          normalizedLabel: 'something else',
          categories: ['Other'],
          confidence: 0.99,
          source: 'ai_new' as const,
        },
      ]),
    }

    const result = await categorizeReceiptPreview({
      previewResult: createPreviewResult([{ text: 'Milk 1L', amount: 2.5 }]),
      repository,
      ai,
    })

    expect(result.items[0]).toMatchObject({
      categories: ['Food', 'Dairy'],
      categorizationSource: 'raw_cache',
      isLowConfidence: false,
    })
    expect(ai.categorizeItems).not.toHaveBeenCalled()
  })

  it('uses a normalized cache hit when no raw mapping exists', async () => {
    const repository = createInMemoryReceiptCategorizationRepository()
    await repository.ensureStarterTaxonomy()
    await repository.persistAiSuggestion({
      rawLabelKey: createReceiptLabelKey('Bananas org'),
      rawLabel: 'Bananas org',
      normalizedLabelKey: createNormalizedLabelKey('organic bananas'),
      normalizedLabel: 'organic bananas',
      categories: ['Food', 'Produce'],
      confidence: 0.9,
    })
    const ai = {
      categorizeItems: vi.fn().mockResolvedValue([]),
    }

    const result = await categorizeReceiptPreview({
      previewResult: createPreviewResult([
        { text: 'Organic bananas', amount: 3.2 },
      ]),
      repository,
      ai,
    })

    expect(result.items[0]).toMatchObject({
      categories: ['Food', 'Produce'],
      categorizationSource: 'normalized_cache',
      isLowConfidence: false,
    })
    expect(ai.categorizeItems).not.toHaveBeenCalled()
  })

  it('shows low-confidence AI suggestions without persisting them', async () => {
    const repository = createInMemoryReceiptCategorizationRepository()
    const ai = {
      categorizeItems: vi.fn().mockResolvedValue([
        {
          itemIndex: 0,
          normalizedLabel: 'organic bananas',
          categories: ['Food', 'Produce'],
          confidence: 0.7,
          source: 'ai_existing' as const,
        },
      ]),
    }

    const result = await categorizeReceiptPreview({
      previewResult: createPreviewResult([
        { text: 'Organic bananas', amount: 3.2 },
      ]),
      repository,
      ai,
    })

    expect(result.items[0]).toMatchObject({
      categories: ['Food', 'Produce'],
      categorizationSource: 'ai_existing',
      categorizationConfidence: 0.7,
      isLowConfidence: true,
    })
    await expect(
      repository.getNormalizedMappings([
        createNormalizedLabelKey('organic bananas'),
      ]),
    ).resolves.toEqual(new Map())
  })

  it('persists confident AI suggestions for later reuse', async () => {
    const repository = createInMemoryReceiptCategorizationRepository()
    const ai = {
      categorizeItems: vi.fn().mockResolvedValue([
        {
          itemIndex: 0,
          normalizedLabel: 'paper towels',
          categories: ['Household', 'Paper Goods'],
          confidence: 0.91,
          source: 'ai_new' as const,
        },
      ]),
    }

    const result = await categorizeReceiptPreview({
      previewResult: createPreviewResult([
        { text: 'Papirhåndklær', amount: 5 },
      ]),
      repository,
      ai,
    })

    expect(result.items[0]).toMatchObject({
      categories: ['Household', 'Paper Goods'],
      categorizationSource: 'ai_new',
      isLowConfidence: false,
    })

    const persistedMappings = await repository.getNormalizedMappings([
      createNormalizedLabelKey('paper towels'),
    ])

    expect(
      persistedMappings.get(createNormalizedLabelKey('paper towels')),
    ).toMatchObject({
      categories: ['Household', 'Paper Goods'],
    })
  })
})

function createPreviewResult(
  items: Array<{ text: string; amount: number | null }>,
): ReceiptOcrPreviewResult {
  return {
    items: items.map((item) => ({
      ...item,
      categories: [],
      categorizationConfidence: null,
      categorizationSource: null,
      isLowConfidence: false,
    })),
    subtotal: null,
    total: null,
    currency: 'USD',
    sanityCheck: {
      itemSum: null,
      compareTarget: 'none',
      expected: null,
      delta: null,
      status: 'unavailable',
    },
    rawWarnings: [],
  }
}
