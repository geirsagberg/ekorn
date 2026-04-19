import { v } from 'convex/values'
import { deriveSavedReceiptStatus } from '../src/features/receipt-ocr/saved-receipts'
import type { Id } from './_generated/dataModel'
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from './_generated/server'
import {
  receiptOcrPreviewResultValidator,
  savedReceiptFxConversionValidator,
} from './receiptTypes'
import { getCurrentUserOrThrow, upsertCurrentUser } from './users'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx)
    const receipts = await ctx.db
      .query('receipts')
      .withIndex('by_user_and_created_at', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(100)

    return await Promise.all(
      receipts.map((receipt) => serializeReceipt(ctx, receipt)),
    )
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await upsertCurrentUser(ctx)

    if (!user.isAllowed) {
      throw new Error('This account is not allowed to use Ekorn.')
    }

    return await ctx.storage.generateUploadUrl()
  },
})

export const create = mutation({
  args: {
    analysis: receiptOcrPreviewResultValidator,
    createdAt: v.string(),
    fxConversion: savedReceiptFxConversionValidator,
    imageName: v.string(),
    imageType: v.string(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const user = await upsertCurrentUser(ctx)

    if (!user.isAllowed) {
      throw new Error('This account is not allowed to use Ekorn.')
    }

    const receiptId = await ctx.db.insert('receipts', {
      userId: user._id,
      createdAt: args.createdAt,
      merchantName: args.analysis.merchantName,
      purchaseDate: args.analysis.purchaseDate,
      currency: args.analysis.currency,
      subtotal: args.analysis.subtotal,
      total: args.analysis.total,
      status: deriveSavedReceiptStatus(args.analysis),
      fxConversion: args.fxConversion,
      imageStorageId: args.storageId,
      imageName: args.imageName,
      imageType: args.imageType,
      analysis: args.analysis,
    })

    const receipt = await ctx.db.get(receiptId)

    if (!receipt) {
      throw new Error('Could not save this receipt.')
    }

    return await serializeReceipt(ctx, receipt)
  },
})

export const update = mutation({
  args: {
    analysis: receiptOcrPreviewResultValidator,
    fxConversion: savedReceiptFxConversionValidator,
    receiptId: v.id('receipts'),
  },
  handler: async (ctx, args) => {
    const user = await upsertCurrentUser(ctx)

    if (!user.isAllowed) {
      throw new Error('This account is not allowed to use Ekorn.')
    }

    const receipt = await requireOwnedReceipt(ctx, args.receiptId, user._id)

    await ctx.db.patch(receipt._id, {
      merchantName: args.analysis.merchantName,
      purchaseDate: args.analysis.purchaseDate,
      currency: args.analysis.currency,
      subtotal: args.analysis.subtotal,
      total: args.analysis.total,
      status: deriveSavedReceiptStatus(args.analysis),
      fxConversion: args.fxConversion,
      analysis: args.analysis,
    })

    const updatedReceipt = await ctx.db.get(receipt._id)

    if (!updatedReceipt) {
      throw new Error('Could not update this receipt.')
    }

    return await serializeReceipt(ctx, updatedReceipt)
  },
})

export const remove = mutation({
  args: {
    receiptId: v.id('receipts'),
  },
  handler: async (ctx, args) => {
    const user = await upsertCurrentUser(ctx)

    if (!user.isAllowed) {
      throw new Error('This account is not allowed to use Ekorn.')
    }

    const receipt = await requireOwnedReceipt(ctx, args.receiptId, user._id)

    await ctx.storage.delete(receipt.imageStorageId)
    await ctx.db.delete(receipt._id)

    return null
  },
})

async function requireOwnedReceipt(
  ctx: MutationCtx,
  receiptId: Id<'receipts'>,
  userId: Id<'users'>,
) {
  const receipt = await ctx.db.get(receiptId)

  if (!receipt || receipt.userId !== userId) {
    throw new Error('That receipt is no longer available.')
  }

  return receipt
}

async function serializeReceipt(
  ctx: QueryCtx | MutationCtx,
  receipt: {
    _id: Id<'receipts'>
    createdAt: string
    merchantName: string | null
    purchaseDate: string | null
    currency: string | null
    subtotal: number | null
    total: number | null
    status: 'ready' | 'needs-review'
    fxConversion: {
      sourceCurrency: string
      targetCurrency: string
      basisDate: string
      basisKind: 'purchase_date' | 'capture_date_fallback'
      effectiveRateDate: string | null
      rate: number | null
      provider: 'ECB'
      convertedTotal: number | null
      convertedSubtotal: number | null
      conversionStatus: 'exact' | 'fallback_cached' | 'unavailable'
    } | null
    imageStorageId: Id<'_storage'>
    imageName: string
    imageType: string
    analysis: {
      items: Array<{
        text: string
        amount: number | null
        categories: string[]
        categorizationConfidence: number | null
        categorizationSource:
          | 'raw_cache'
          | 'normalized_cache'
          | 'ai_existing'
          | 'ai_new'
          | null
        isLowConfidence: boolean
      }>
      merchantName: string | null
      purchaseDate: string | null
      subtotal: number | null
      total: number | null
      currency: string | null
      sanityCheck: {
        itemSum: number | null
        compareTarget: 'subtotal' | 'total' | 'none'
        expected: number | null
        delta: number | null
        status: 'ok' | 'warning' | 'unavailable'
      }
      rawWarnings: string[]
    }
  },
) {
  return {
    id: receipt._id,
    createdAt: receipt.createdAt,
    merchant: receipt.merchantName,
    total: receipt.total,
    subtotal: receipt.subtotal,
    currency: receipt.currency,
    status: receipt.status,
    fxConversion: receipt.fxConversion,
    imageBlob: null,
    imageName: receipt.imageName,
    imageType: receipt.imageType,
    imageUrl: await ctx.storage.getUrl(receipt.imageStorageId),
    imageStorageId: receipt.imageStorageId,
    analysis: receipt.analysis,
  }
}
