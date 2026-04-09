import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  households: defineTable({
    name: v.string(),
    slug: v.string(),
    createdByUserId: v.optional(v.string()),
  }).index('by_slug', ['slug']),
  receipts: defineTable({
    householdId: v.id('households'),
    uploadedByUserId: v.optional(v.string()),
    sourceAssetId: v.optional(v.string()),
    sourceAssetUrl: v.optional(v.string()),
    merchantName: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),
    currency: v.optional(v.string()),
    subtotal: v.optional(v.number()),
    total: v.optional(v.number()),
    extractionStatus: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('ready'),
      v.literal('failed'),
    ),
    duplicateStatus: v.union(
      v.literal('clear'),
      v.literal('possible_duplicate'),
      v.literal('confirmed_duplicate'),
    ),
  })
    .index('by_household', ['householdId'])
    .index('by_household_and_purchase_date', ['householdId', 'purchaseDate']),
  receiptItems: defineTable({
    receiptId: v.id('receipts'),
    rawLabel: v.string(),
    normalizedLabel: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unitPrice: v.optional(v.number()),
    lineTotal: v.optional(v.number()),
    inferredTagIds: v.array(v.id('tags')),
    finalTagIds: v.array(v.id('tags')),
    taggingConfidence: v.optional(v.number()),
    rowIndex: v.number(),
  }).index('by_receipt', ['receiptId']),
  tags: defineTable({
    name: v.string(),
    slug: v.string(),
    parentTagId: v.optional(v.id('tags')),
    isSystemGenerated: v.boolean(),
  })
    .index('by_slug', ['slug'])
    .index('by_parent', ['parentTagId']),
  itemTagConnections: defineTable({
    normalizedLabelKey: v.string(),
    normalizedLabel: v.string(),
    tagIds: v.array(v.id('tags')),
    confidence: v.number(),
    source: v.union(v.literal('ai'), v.literal('admin')),
  }).index('by_normalized_label_key', ['normalizedLabelKey']),
  rawItemMappings: defineTable({
    rawLabelKey: v.string(),
    rawLabel: v.string(),
    normalizedLabel: v.string(),
    confidence: v.number(),
    source: v.union(v.literal('ai'), v.literal('admin')),
  }).index('by_raw_label_key', ['rawLabelKey']),
})
