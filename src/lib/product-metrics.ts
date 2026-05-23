/**
 * Admin list views: price/stock live on variants when present, otherwise on the product row (simple products).
 */
export function listPriceFromProduct(p: {
  variants?: { price?: number | string | null }[] | null
  price?: number | string | null
}): number {
  const variants = p.variants ?? []
  const fromVariants = variants
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n))
  if (fromVariants.length > 0) {
    return Math.min(...fromVariants)
  }
  const q = Number(p.price)
  return Number.isFinite(q) ? q : 0
}

export function listStockFromProduct(p: {
  variants?: { stock_quantity?: number | string | null }[] | null
  quantity?: number | string | null
}): number {
  const variants = p.variants ?? []
  if (variants.length === 0) {
    return Number(p.quantity) || 0
  }
  return variants.reduce((sum, v) => sum + (Number(v.stock_quantity) || 0), 0)
}

/** Raw SKU for display/search: first variant, else product-level sku. */
export function listSkuRaw(p: {
  variants?: { sku?: string | null }[] | null
  sku?: string | null
}): string {
  const variants = p.variants ?? []
  const first = variants[0]?.sku
  const raw = (first && String(first).trim()) || (p.sku && String(p.sku).trim()) || ''
  return raw
}
