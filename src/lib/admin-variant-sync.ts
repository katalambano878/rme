import { buildOptionValues, type VariantOptionValue } from './variant-options'

/**
 * Plans how to bring a product's `variants` rows in line with what the admin
 * selected, updating rows in place instead of delete-all + re-insert.
 *
 * Keeping row ids matters: `cart_items.variant_id` cascades on delete (shoppers'
 * carts were being emptied) and `order_items.variant_id` is nulled (order history
 * lost its variant link) every time a product was saved.
 */

export type DesiredVariant = {
  id?: string
  size: string
  color: string
  colorHex?: string
  sku?: string
  price: number
  compareAtPrice: number | null
  salePrice: number | null
  stock: number
}

export type VariantRowPayload = {
  sku: string
  price: number
  compare_at_price: number | null
  sale_price: number | null
  stock_quantity: number
  option_values: VariantOptionValue[]
}

export type VariantSyncPlan = {
  toDelete: string[]
  toUpdate: { id: string; row: VariantRowPayload }[]
  toInsert: VariantRowPayload[]
}

export function planVariantSync(
  existingIds: string[],
  desired: DesiredVariant[],
  baseSku: string,
): VariantSyncPlan {
  const existing = new Set(existingIds)
  const keptIds = new Set(desired.map((d) => d.id).filter((id): id is string => !!id && existing.has(id)))
  const usedSkus = new Set(
    desired
      .filter((d) => d.id && keptIds.has(d.id) && d.sku?.trim())
      .map((d) => d.sku!.trim().toLowerCase()),
  )

  let suffix = 1
  const nextSku = (): string => {
    if (desired.length === 1 && !usedSkus.has(baseSku.toLowerCase())) {
      usedSkus.add(baseSku.toLowerCase())
      return baseSku
    }
    let candidate = `${baseSku}-${suffix}`
    while (usedSkus.has(candidate.toLowerCase())) {
      suffix += 1
      candidate = `${baseSku}-${suffix}`
    }
    usedSkus.add(candidate.toLowerCase())
    suffix += 1
    return candidate
  }

  const plan: VariantSyncPlan = {
    toDelete: existingIds.filter((id) => !keptIds.has(id)),
    toUpdate: [],
    toInsert: [],
  }

  for (const d of desired) {
    const isKept = !!d.id && keptIds.has(d.id)
    const ownSku = d.sku?.trim()
    const sku = ownSku && (isKept || !usedSkus.has(ownSku.toLowerCase())) ? ownSku : nextSku()
    if (!isKept) usedSkus.add(sku.toLowerCase())
    const row: VariantRowPayload = {
      sku,
      price: d.price,
      compare_at_price: d.compareAtPrice,
      sale_price: d.salePrice,
      stock_quantity: d.stock,
      option_values: buildOptionValues({ size: d.size, color: d.color, colorHex: d.colorHex }),
    }
    if (isKept) plan.toUpdate.push({ id: d.id!, row })
    else plan.toInsert.push(row)
  }

  return plan
}
