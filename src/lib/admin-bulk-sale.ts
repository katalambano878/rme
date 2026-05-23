import type { SupabaseClient } from '@supabase/supabase-js'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Retail / list price used as the anchor for a sale (matches storefront cardPricing). */
export function listPriceFromPrices(
  price: number,
  compareAt: number | string | null | undefined,
): number {
  const pr = Number(price) || 0
  const cp =
    compareAt != null && compareAt !== '' ? Number(compareAt) : NaN
  if (Number.isFinite(cp) && cp > pr) return round2(cp)
  return round2(pr)
}

export type BulkDiscountScope = 'all' | 'selected'

export async function applyBulkDiscountPercent(
  supabase: SupabaseClient,
  percent: number,
  opts: { scope: BulkDiscountScope; selectedIds?: string[] },
): Promise<{ updated: number; errors: string[] }> {
  const pct = Math.max(0, Math.min(99, percent))
  if (pct <= 0) {
    return { updated: 0, errors: ['Choose a discount between 1% and 99%.'] }
  }
  const factor = 1 - pct / 100

  let productIds: string[] = []
  if (opts.scope === 'selected') {
    productIds = opts.selectedIds ?? []
    if (productIds.length === 0) {
      return {
        updated: 0,
        errors: ['Select at least one product, or switch to “All products”.'],
      }
    }
  } else {
    const { data, error } = await supabase.from('products').select('id')
    if (error) return { updated: 0, errors: [error.message] }
    productIds = (data ?? []).map((r) => r.id)
  }

  const errors: string[] = []
  let updated = 0

  for (const productId of productIds) {
    try {
      const { data: row, error: fetchErr } = await supabase
        .from('products')
        .select('id, price, compare_at_price, variants(id, price, compare_at_price)')
        .eq('id', productId)
        .maybeSingle()

      if (fetchErr) throw fetchErr
      if (!row) continue

      type VarRow = { id: string; price: number | string | null; compare_at_price: number | string | null }
      const variants = (row as { variants?: VarRow[] }).variants ?? []

      // Determine the regular (non-sale) price: lowest variant price, or product price
      const variantPrices = variants
        .map((v) => Number(v.price) || 0)
        .filter((p) => p > 0)
      const regularPrice =
        variantPrices.length > 0
          ? Math.min(...variantPrices)
          : listPriceFromPrices(
              Number((row as { price?: number | string | null }).price) || 0,
              (row as { compare_at_price?: number | string | null }).compare_at_price,
            )

      if (regularPrice <= 0) continue
      const newSale = round2(regularPrice * factor)
      const onSale = newSale < regularPrice - 0.001

      // Write sale_price column — do NOT touch variant prices (they stay as regular prices)
      const { error: pe } = await supabase
        .from('products')
        .update({ sale_price: onSale ? newSale : null })
        .eq('id', productId)
      if (pe) throw pe

      updated++
    } catch (e: unknown) {
      errors.push(
        `${productId}: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return { updated, errors }
}
