/**
 * Backfills stock reduction for orders that were marked paid but never had
 * their stock decremented (because the old rpc('reduce_order_stock') was a
 * silent no-op).
 *
 * Usage:
 *   node scripts/backfill-stock-reduction.mjs            # dry-run
 *   node scripts/backfill-stock-reduction.mjs --apply    # actually reduce
 *
 * Idempotent: if any inventory_movements row already exists for an order, the
 * order is skipped. So running this twice is safe.
 *
 * Runs only against orders whose status is paid/processing/shipped/delivered
 * AND that have at least one payments row with status paid/completed.
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

function loadDotEnv() {
  for (const p of [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), ".env")]) {
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const eq = t.indexOf("=")
      if (eq === -1) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (process.env[k] === undefined) process.env[k] = v
    }
  }
}
loadDotEnv()

const apply = process.argv.includes("--apply")
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// Inline copy of the helper so this script is self-contained (no TS build needed).
async function reduceOrderStock(orderId, { dryRun }) {
  const result = { items: [], errors: [], skipped: false, dryRun }

  const { data: existing, error: existingErr } = await supabase
    .from("inventory_movements")
    .select("id")
    .eq("reference_type", "order")
    .eq("reference_id", orderId)
    .limit(1)
  if (existingErr) result.errors.push(`inventory_movements lookup: ${existingErr.message}`)
  if (existing && existing.length > 0) {
    result.skipped = true
    return result
  }

  const { data: orderItems, error: itemsErr } = await supabase
    .from("order_items")
    .select(
      "id, quantity, variant_id, product_id, name_snapshot, products(id, quantity, variants(id, price, stock_quantity))",
    )
    .eq("order_id", orderId)
  if (itemsErr) {
    result.errors.push(`order_items lookup: ${itemsErr.message}`)
    return result
  }
  if (!orderItems?.length) {
    result.errors.push("no order_items")
    return result
  }

  for (const it of orderItems) {
    const qty = Number(it.quantity) || 0
    if (qty <= 0) continue

    const productVariants = (it.products?.variants || []).slice().sort(
      (a, b) => Number(a.price) - Number(b.price),
    )
    let variantId = it.variant_id ?? null
    if (!variantId && productVariants.length > 0) variantId = productVariants[0].id

    if (variantId) {
      let variant = productVariants.find((v) => v.id === variantId)
      if (!variant) {
        const { data } = await supabase
          .from("variants")
          .select("id, stock_quantity")
          .eq("id", variantId)
          .maybeSingle()
        variant = data ? { id: data.id, price: 0, stock_quantity: Number(data.stock_quantity) } : null
      }
      if (!variant) {
        result.errors.push(`variant ${variantId} not found for "${it.name_snapshot}"`)
        continue
      }
      const before = Number(variant.stock_quantity) || 0
      const after = Math.max(0, before - qty)
      const entry = {
        name: it.name_snapshot,
        target: "variant",
        variantId,
        quantity: qty,
        before,
        after,
      }
      if (!dryRun) {
        const { error: vErr } = await supabase
          .from("variants")
          .update({ stock_quantity: after, updated_at: new Date().toISOString() })
          .eq("id", variantId)
        if (vErr) {
          entry.error = vErr.message
          result.errors.push(`variant update for "${it.name_snapshot}": ${vErr.message}`)
        } else {
          const { error: mErr } = await supabase.from("inventory_movements").insert({
            variant_id: variantId,
            quantity_delta: -qty,
            reason: "order_paid_backfill",
            reference_type: "order",
            reference_id: orderId,
          })
          if (mErr) result.errors.push(`movement insert: ${mErr.message}`)
        }
      }
      result.items.push(entry)
    } else if (it.product_id) {
      const before = Number(it.products?.quantity) || 0
      const after = Math.max(0, before - qty)
      const entry = {
        name: it.name_snapshot,
        target: "product",
        productId: it.product_id,
        quantity: qty,
        before,
        after,
      }
      if (!dryRun) {
        const { error: pErr } = await supabase
          .from("products")
          .update({ quantity: after, updated_at: new Date().toISOString() })
          .eq("id", it.product_id)
        if (pErr) {
          entry.error = pErr.message
          result.errors.push(`product update for "${it.name_snapshot}": ${pErr.message}`)
        }
      }
      result.items.push(entry)
    } else {
      result.errors.push(`item "${it.name_snapshot}" has no product or variant id`)
    }
  }
  return result
}

const { data: orders, error } = await supabase
  .from("orders")
  .select("id, order_number, status, payments!inner(status)")
  .in("status", ["paid", "processing", "shipped", "delivered"])
  .order("created_at", { ascending: true })

if (error) {
  console.error(error)
  process.exit(1)
}

const eligible = (orders || []).filter((o) =>
  (o.payments || []).some((p) => p.status === "paid" || p.status === "completed"),
)

console.log(`Eligible orders (paid + status >= paid): ${eligible.length}`)
console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}\n`)

let touched = 0
let skipped = 0
let errored = 0

for (const o of eligible) {
  const r = await reduceOrderStock(o.id, { dryRun: !apply })
  if (r.skipped) {
    skipped++
    continue
  }
  if (r.errors.length && !r.items.length) {
    errored++
    console.log(`  [ERROR] ${o.order_number}: ${r.errors.join("; ")}`)
    continue
  }
  touched++
  console.log(`  ${apply ? "[APPLIED]" : "[DRY]"} ${o.order_number}`)
  for (const it of r.items) {
    const label = it.error ? `ERROR: ${it.error}` : `${it.before} -> ${it.after}`
    console.log(`     - ${it.name} (qty ${it.quantity})  ${it.target}=${it.variantId || it.productId}  ${label}`)
  }
  if (r.errors.length) console.log(`     errors: ${r.errors.join("; ")}`)
}

console.log("")
console.log(`Touched: ${touched}`)
console.log(`Skipped (already reduced): ${skipped}`)
console.log(`Errors: ${errored}`)
if (!apply) console.log("\nDRY RUN. Re-run with --apply to commit.")
