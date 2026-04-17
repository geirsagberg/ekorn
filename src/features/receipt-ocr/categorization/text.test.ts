import { describe, expect, it } from 'vitest'
import {
  createReceiptLabelKey,
  normalizeReceiptLabel,
  slugifyCategoryName,
} from './text'

describe('receipt categorization text helpers', () => {
  it('normalizes receipt labels into stable lowercase text', () => {
    expect(normalizeReceiptLabel('  MØRK  Sjokolade, 70%  ')).toBe(
      'mørk sjokolade 70%',
    )
  })

  it('builds deterministic label keys without punctuation noise', () => {
    expect(createReceiptLabelKey('  Milk / 1L  ')).toBe('milk-1l')
    expect(createReceiptLabelKey('BANANAS, organic!')).toBe('bananas-organic')
  })

  it('slugifies category names consistently', () => {
    expect(slugifyCategoryName('Meat & Seafood')).toBe('meat-and-seafood')
  })
})
