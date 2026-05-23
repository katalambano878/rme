/**
 * Read-only diagnosis: is stock being reduced when orders are paid?
 *
 * 1. Inspects the live `reduce_order_stock` RPC source from pg_proc.
 * 2. Pulls the most-recent paid orders and their order_items.
 * 3. Looks for inventory_movements rows tied to those orders.
 * 4. Reports whether stock was actually decremented for each.
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import pg from "pg"

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

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not set in .env.local — falling back to Supabase REST RPC introspection.")
}

const cs = process.env.DATABASE_URL
if (!cs) {
  // No DATABASE_URL — fallback: just check inventory_movements via Supabase REST.
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  console.log("=== Inventory movements (last 20) ===")
  const { data: moves, error: mErr } = await supabase
    .from("inventory_movements")
    .select("created_at, variant_id, quantity_delta, reason, reference_type, reference_id")
    .order("created_at", { ascending: false })
    .limit(20)
  if (mErr) console.log("ERROR:", mErr.message)
  else if (!moves.length) console.log("  (NO inventory_movements rows at all)")
  else for (const m of moves) console.log(`  ${m.created_at}  delta=${m.quantity_delta}  reason=${m.reason}  ref=${m.reference_type}/${m.reference_id?.slice(0, 8)}`)

  console.log("\n=== Last 5 paid orders with their items + current stock ===")
  const { data: paid } = await supabase
    .from("orders")
    .select(`
      order_number, status, created_at,
      payments!inner(status, updated_at, provider),
      order_items(quantity, product_id, variant_id, name_snapshot)
    `)
    .or("status.eq.paid,status.eq.delivered,status.eq.processing,status.eq.shipped")
    .order("created_at", { ascending: false })
    .limit(5)

  for (const o of paid || []) {
    console.log(`\n  ${o.order_number}  status=${o.status}  paid_at=${o.payments?.[0]?.updated_at}`)
    for (const it of o.order_items || []) {
      let curStock = "?"
      if (it.variant_id) {
        const { data: v } = await supabase.from("variants").select("stock_quantity").eq("id", it.variant_id).maybeSingle()
        curStock = v ? `variant.stock=${v.stock_quantity}` : "(variant deleted)"
      } else if (it.product_id) {
        const { data: p } = await supabase.from("products").select("quantity").eq("id", it.product_id).maybeSingle()
        curStock = p ? `product.qty=${p.quantity}` : "(product deleted)"
      }
      console.log(`     - sold ${it.quantity} × ${it.name_snapshot} → ${curStock}`)
    }
  }
  process.exit(0)
}

// ---- pg path: full inspection ----
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } })
await client.connect()

console.log("=== reduce_order_stock function source ===")
{
  const { rows } = await client.query(`
    select n.nspname as schema, p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           pg_get_functiondef(p.oid) as src
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'reduce_order_stock'
  `)
  if (!rows.length) console.log("  (function not found)")
  else for (const r of rows) {
    console.log(`  ${r.schema}.${r.name}(${r.args})`)
    console.log("\n--- BODY ---\n" + r.src + "\n--- END ---\n")
  }
}

console.log("=== inventory_movements rows tied to recent orders ===")
{
  const { rows } = await client.query(`
    select m.created_at, m.quantity_delta, m.reason, m.reference_type, m.reference_id,
           o.order_number, o.status as order_status
    from public.inventory_movements m
    left join public.orders o on o.id::text = m.reference_id::text
    order by m.created_at desc
    limit 20
  `)
  if (!rows.length) console.log("  (NO rows in inventory_movements at all)")
  else for (const r of rows) {
    console.log(`  ${r.created_at.toISOString()}  delta=${r.quantity_delta}  reason=${r.reason}  ref=${r.reference_type}  order=${r.order_number || "(unknown)"}`)
  }
}

console.log("\n=== Last 5 paid/delivered/processing/shipped orders + items + current stock ===")
{
  const { rows } = await client.query(`
    select o.order_number, o.status, o.created_at,
           oi.quantity, oi.name_snapshot, oi.variant_id, oi.product_id,
           v.stock_quantity as variant_stock,
           p.quantity as product_qty
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    left join public.variants v on v.id = oi.variant_id
    left join public.products p on p.id = oi.product_id
    where o.status in ('paid','delivered','processing','shipped')
    order by o.created_at desc
    limit 30
  `)
  let lastOrd = null
  for (const r of rows) {
    if (r.order_number !== lastOrd) {
      console.log(`\n  ${r.order_number}  status=${r.status}  ${r.created_at.toISOString()}`)
      lastOrd = r.order_number
    }
    const stk = r.variant_id ? `variant.stock=${r.variant_stock}` : `product.qty=${r.product_qty}`
    console.log(`     - sold ${r.quantity} × ${r.name_snapshot}  → ${stk}`)
  }
}

await client.end()
