import { api } from "@/lib/api"

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function listPriceFromPrices(
  price: number,
  compareAt: number | string | null | undefined,
): number {
  const pr = Number(price) || 0
  const cp = compareAt != null && compareAt !== "" ? Number(compareAt) : NaN
  if (Number.isFinite(cp) && cp > pr) return round2(cp)
  return round2(pr)
}

export type BulkDiscountScope = "all" | "selected"

type ProductRow = {
  id: string
  price?: number | string | null
  compare_at_price?: number | string | null
  variants?: { id: string; price: number | string | null; compare_at_price: number | string | null }[]
}

export async function applyBulkDiscountPercent(
  percent: number,
  opts: { scope: BulkDiscountScope; selectedIds?: string[] },
): Promise<{ updated: number; errors: string[] }> {
  const pct = Math.max(0, Math.min(99, percent))
  if (pct <= 0) {
    return { updated: 0, errors: ["Choose a discount between 1% and 99%."] }
  }
  const factor = 1 - pct / 100

  let productIds: string[] = []
  if (opts.scope === "selected") {
    productIds = opts.selectedIds ?? []
    if (productIds.length === 0) {
      return {
        updated: 0,
        errors: ["Select at least one product, or switch to “All products”."],
      }
    }
  } else {
    try {
      const data = await api<ProductRow[]>("/api/catalog/products")
      productIds = data.map((r) => r.id)
    } catch (err) {
      return { updated: 0, errors: [err instanceof Error ? err.message : "Could not list products"] }
    }
  }

  const errors: string[] = []
  let updated = 0

  for (const productId of productIds) {
    try {
      const row = await api<ProductRow>(`/api/catalog/products/${productId}`)
      const variants = row.variants ?? []

      const variantPrices = variants
        .map((v) => Number(v.price) || 0)
        .filter((p) => p > 0)
      const regularPrice =
        variantPrices.length > 0
          ? Math.min(...variantPrices)
          : listPriceFromPrices(Number(row.price) || 0, row.compare_at_price)

      if (regularPrice <= 0) continue
      const newSale = round2(regularPrice * factor)
      const onSale = newSale < regularPrice - 0.001

      await api(`/api/catalog/products/${productId}`, {
        method: "PATCH",
        json: { sale_price: onSale ? newSale : null },
      })
      updated++
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Failed on ${productId}`)
    }
  }

  return { updated, errors }
}
