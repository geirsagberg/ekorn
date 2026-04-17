import { describe, expect, it } from 'vitest'
import {
  createInMemoryReceiptCategorizationRepository,
  createNormalizedLabelKey,
} from './repository'
import { createReceiptLabelKey } from './text'

describe('MemoryReceiptCategorizationRepository', () => {
  it('seeds the starter taxonomy once and reuses tag paths by slug', async () => {
    const repository = createInMemoryReceiptCategorizationRepository()
    await repository.ensureStarterTaxonomy()
    await repository.ensureStarterTaxonomy()
    await repository.persistAiSuggestion({
      rawLabelKey: createReceiptLabelKey('Orange 1'),
      rawLabel: 'Orange 1',
      normalizedLabelKey: createNormalizedLabelKey('orange'),
      normalizedLabel: 'orange',
      categories: ['Food', 'Produce', 'Citrus'],
      confidence: 0.9,
    })
    await repository.persistAiSuggestion({
      rawLabelKey: createReceiptLabelKey('Orange 2'),
      rawLabel: 'Orange 2',
      normalizedLabelKey: createNormalizedLabelKey('orange segments'),
      normalizedLabel: 'orange segments',
      categories: ['Food', 'Produce', 'Citrus'],
      confidence: 0.92,
    })

    const taxonomyPaths = await repository.listTaxonomyPaths()
    const citrusPaths = taxonomyPaths.filter(
      (path) => path.join(' > ') === 'Food > Produce > Citrus',
    )

    expect(citrusPaths).toHaveLength(1)
    expect(taxonomyPaths).toContainEqual(['Food'])
    expect(taxonomyPaths).toContainEqual(['Food', 'Produce'])
    expect(taxonomyPaths).toContainEqual(['Food', 'Produce', 'Citrus'])
  })
})
