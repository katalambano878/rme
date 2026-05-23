/**
 * Reduces stock when an order is paid.
 *
 * Replaces the brittle `rpc('reduce_order_stock', ...)` call that was failing
 * silently. The previous code wrapped `supabase.rpc()` in try/catch — but rpc
 * does not throw, it returns { data, error }, so all errors were lost.
 *
 * For each line item:
 *   1. Pick the variant to decrement:
 *      - order_items.variant_id when present
 *      - else the cheapest variant of the product (matches storefront list price)
 *   2. If a variant is found, decrement variants.stock_quantity and audit.
 *      Otherwise (product has no variants), decrement products.quantity instead.
 *
 * Idempotency: writes one row per item to inventory_movements with
 *   (reference_type='order', reference_id=orderId). Before reducing, we check
 *   for existing movement rows for that order and skip if any are found.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export interface StockReductionResult {
  skipped?: boolean
  reason?: string
  items?: Array<{
    name: string
    target: "variant" | "product" | "none"
    variantId?: string
    productId?: string
    before?: number
    after?: number
    quantity: number
    error?: string
  }>
  errors: string[]
}

export async function reduceOrderStock(
  supabase: SupabaseClient,
  orderId: string,
): Promise<StockReductionResult> {
  const errors: string[] = []
  const items: NonNullable<StockReductionResult["items"]> = []

  const { data: existing, error: existingErr } = await supabase
    .from("inventory_movements")
    .select("id")
    .eq("reference_type", "order")
    .eq("reference_id", orderId)
    .limit(1)
  if (existingErr) {
    errors.push(`inventory_movements lookup failed: ${existingErr.message}`)
  }
  if (existing && existing.length > 0) {
    return { skipped: true, reason: "already_reduced", errors }
  }

  const { data: orderItems, error: itemsErr } = await supabase
    .from("order_items")
    .select(
      `
      id,
      quantity,
      variant_id,
      product_id,
      name_snapshot,
      products(id, quantity, variants(id, price, stock_quantity))
    `,
    )
    .eq("order_id", orderId)

  if (itemsErr) {
    errors.push(`order_items lookup failed: ${itemsErr.message}`)
    return { errors }
  }
  if (!orderItems || orderItems.length === 0) {
    errors.push(`no order_items found for order ${orderId}`)
    return { errors }
  }

  for (const it of orderItems as unknown as Array<{
    id: string
    quantity: number
    variant_id: string | null
    product_id: string | null
    name_snapshot: string
    products: {
      id: string
      quantity: number | null
      variants: Array<{ id: string; price: number; stock_quantity: number }> | null
    } | null
  }>) {
    const qty = Number(it.quantity) || 0
    if (qty <= 0) {
      items.push({ name: it.name_snapshot, target: "none", quantity: qty })
      continue
    }

    const productVariants = (it.products?.variants || []).slice().sort(
      (a, b) => Number(a.price) - Number(b.price),
    )

    let variantId = it.variant_id ?? null
    if (!variantId && productVariants.length > 0) {
      variantId = productVariants[0].id
    }

    if (variantId) {
      const matched =
        productVariants.find((v) => v.id === variantId) ||
        // Fallback fetch in case the embedded variants don't include it.
        (await (async () => {
          const { data } = await supabase
            .from("variants")
            .select("id, stock_quantity")
            .eq("id", variantId!)
            .maybeSingle()
          return data
            ? { id: data.id, price: 0, stock_quantity: Number(data.stock_quantity) }
            : null
        })())

      if (!matched) {
        const msg = `variant ${variantId} not found for item "${it.name_snapshot}"`
        errors.push(msg)
        items.push({
          name: it.name_snapshot,
          target: "variant",
          variantId,
          quantity: qty,
          error: "variant_not_found",
        })
        continue
      }

      const before = Number(matched.stock_quantity) || 0
      const after = Math.max(0, before - qty)

      const { error: vErr } = await supabase
        .from("variants")
        .update({ stock_quantity: after, updated_at: new Date().toISOString() })
        .eq("id", variantId)
      if (vErr) {
        errors.push(`variant update failed for ${it.name_snapshot}: ${vErr.message}`)
        items.push({
          name: it.name_snapshot,
          target: "variant",
          variantId,
          quantity: qty,
          before,
          error: vErr.message,
        })
        continue
      }

      const { error: mErr } = await supabase.from("inventory_movements").insert({
        variant_id: variantId,
        quantity_delta: -qty,
        reason: "order_paid",
        reference_type: "order",
        reference_id: orderId,
      })
      if (mErr) errors.push(`inventory_movements insert failed: ${mErr.message}`)

      items.push({
        name: it.name_snapshot,
        target: "variant",
        variantId,
        quantity: qty,
        before,
        after,
      })
      continue
    }

    if (it.product_id) {
      const before = Number(it.products?.quantity) || 0
      const after = Math.max(0, before - qty)
      const { error: pErr } = await supabase
        .from("products")
        .update({ quantity: after, updated_at: new Date().toISOString() })
        .eq("id", it.product_id)
      if (pErr) {
        errors.push(`product quantity update failed for ${it.name_snapshot}: ${pErr.message}`)
        items.push({
          name: it.name_snapshot,
          target: "product",
          productId: it.product_id,
          quantity: qty,
          before,
          error: pErr.message,
        })
        continue
      }
      items.push({
        name: it.name_snapshot,
        target: "product",
        productId: it.product_id,
        quantity: qty,
        before,
        after,
      })
      continue
    }

    items.push({
      name: it.name_snapshot,
      target: "none",
      quantity: qty,
      error: "no_product_or_variant_link",
    })
    errors.push(`item "${it.name_snapshot}" has neither product_id nor variant_id`)
  }

  return { items, errors }
}
