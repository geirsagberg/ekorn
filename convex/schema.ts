import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  receiptOcrPreviewResultValidator,
  savedReceiptFxConversionValidator,
  savedReceiptStatusValidator,
} from './receiptTypes'

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    email: v.union(v.string(), v.null()),
    name: v.union(v.string(), v.null()),
    isAllowed: v.boolean(),
    lastSeenAt: v.string(),
  }).index('by_token_identifier', ['tokenIdentifier']),
  receipts: defineTable({
    userId: v.id('users'),
    createdAt: v.string(),
    merchantName: v.union(v.string(), v.null()),
    purchaseDate: v.union(v.string(), v.null()),
    currency: v.union(v.string(), v.null()),
    subtotal: v.union(v.number(), v.null()),
    total: v.union(v.number(), v.null()),
    status: savedReceiptStatusValidator,
    fxConversion: savedReceiptFxConversionValidator,
    imageStorageId: v.id('_storage'),
    imageName: v.string(),
    imageType: v.string(),
    analysis: receiptOcrPreviewResultValidator,
  }).index('by_user_and_created_at', ['userId', 'createdAt']),
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
