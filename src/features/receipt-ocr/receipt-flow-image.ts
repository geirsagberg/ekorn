import type { Id } from '../../../convex/_generated/dataModel'
import type { SavedReceipt } from './saved-receipts'

export async function loadReceiptImageFile(receipt: SavedReceipt) {
  if (receipt.imageBlob) {
    return new File([receipt.imageBlob], receipt.imageName, {
      type: receipt.imageType,
    })
  }

  if (!receipt.imageUrl) {
    throw new Error('This receipt image is no longer available.')
  }

  const response = await fetch(receipt.imageUrl)

  if (!response.ok) {
    throw new Error('Could not load this receipt image.')
  }

  const imageBlob = await response.blob()

  return new File([imageBlob], receipt.imageName, {
    type: receipt.imageType || imageBlob.type || 'application/octet-stream',
  })
}

export async function uploadReceiptImage({
  file,
  generateUploadUrl,
}: {
  file: File
  generateUploadUrl: (args: Record<string, never>) => Promise<string>
}) {
  const uploadUrl = await generateUploadUrl({})
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error('Could not upload this receipt image.')
  }

  const result = (await response.json()) as {
    storageId?: Id<'_storage'>
  }

  if (!result.storageId) {
    throw new Error('Could not store this receipt image.')
  }

  return result.storageId
}
