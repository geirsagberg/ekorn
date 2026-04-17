export function normalizeReceiptLabel(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function createReceiptLabelKey(text: string) {
  const normalized = normalizeReceiptLabel(text)

  return normalized.length > 0
    ? normalized
        .replace(/%/g, ' percent ')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    : 'item'
}

export function normalizeCategoryName(name: string) {
  return name.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

export function slugifyCategoryName(name: string) {
  return createReceiptLabelKey(normalizeCategoryName(name))
}
