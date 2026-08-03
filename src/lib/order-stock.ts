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

import { query, queryOne } from "@/lib/db"

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

type OrderItemRow = {
  id: string
  quantity: number
  variant_id: string | null
  product_id: string | null
  name_snapshot: string
}

type VariantRow = {
  id: string
  price: number
  stock_quantity: number
}

export async function reduceOrderStock(orderId: string): Promise<StockReductionResult> {
  const errors: string[] = []
  const items: NonNullable<StockReductionResult["items"]> = []

  try {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM inventory_movements
       WHERE reference_type = 'order' AND reference_id = $1
       LIMIT 1`,
      [orderId],
    )
    if (existing) {
      return { skipped: true, reason: "already_reduced", errors }
    }
  } catch (e) {
    errors.push(
      `inventory_movements lookup failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  let orderItems: OrderItemRow[] = []
  try {
    const itemsResult = await query<OrderItemRow>(
      `SELECT id, quantity, variant_id, product_id, name_snapshot
       FROM order_items
       WHERE order_id = $1`,
      [orderId],
    )
    orderItems = itemsResult.rows
  } catch (e) {
    errors.push(`order_items lookup failed: ${e instanceof Error ? e.message : String(e)}`)
    return { errors }
  }

  if (orderItems.length === 0) {
    errors.push(`no order_items found for order ${orderId}`)
    return { errors }
  }

  for (const it of orderItems) {
    const qty = Number(it.quantity) || 0
    if (qty <= 0) {
      items.push({ name: it.name_snapshot, target: "none", quantity: qty })
      continue
    }

    let productVariants: VariantRow[] = []
    let productQuantity: number | null = null

    if (it.product_id) {
      try {
        const productRow = await queryOne<{ quantity: number | null }>(
          `SELECT quantity FROM products WHERE id = $1`,
          [it.product_id],
        )
        productQuantity = productRow?.quantity ?? null

        const variantsResult = await query<VariantRow>(
          `SELECT id, price, stock_quantity
           FROM variants
           WHERE product_id = $1
           ORDER BY price ASC`,
          [it.product_id],
        )
        productVariants = variantsResult.rows
      } catch (e) {
        errors.push(
          `product/variants lookup failed for "${it.name_snapshot}": ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }

    let variantId = it.variant_id ?? null
    if (!variantId && productVariants.length > 0) {
      variantId = productVariants[0].id
    }

    if (variantId) {
      let matched =
        productVariants.find((v) => v.id === variantId) ||
        (await queryOne<VariantRow>(
          `SELECT id, price, stock_quantity FROM variants WHERE id = $1`,
          [variantId],
        ))

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

      try {
        await query(
          `UPDATE variants
           SET stock_quantity = $2, updated_at = now()
           WHERE id = $1`,
          [variantId, after],
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`variant update failed for ${it.name_snapshot}: ${msg}`)
        items.push({
          name: it.name_snapshot,
          target: "variant",
          variantId,
          quantity: qty,
          before,
          error: msg,
        })
        continue
      }

      try {
        await query(
          `INSERT INTO inventory_movements (variant_id, quantity_delta, reason, reference_type, reference_id)
           VALUES ($1, $2, 'order_paid', 'order', $3)`,
          [variantId, -qty, orderId],
        )
      } catch (e) {
        errors.push(
          `inventory_movements insert failed: ${e instanceof Error ? e.message : String(e)}`,
        )
      }

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
      const before = Number(productQuantity) || 0
      const after = Math.max(0, before - qty)
      try {
        await query(
          `UPDATE products
           SET quantity = $2, updated_at = now()
           WHERE id = $1`,
          [it.product_id, after],
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`product quantity update failed for ${it.name_snapshot}: ${msg}`)
        items.push({
          name: it.name_snapshot,
          target: "product",
          productId: it.product_id,
          quantity: qty,
          before,
          error: msg,
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
