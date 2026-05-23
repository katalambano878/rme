/**
 * Diagnose why product cards still show as "on sale" when the toggle is off.
 *
 * Two paths in storefront-products.ts -> cardPricing() can produce a salePrice:
 *   A) global toggle on  AND product metadata has on_sale + sales_price
 *   B) any variant has compare_at_price > price (RUNS UNCONDITIONALLY — toggle is ignored)
 *
 * Run: node scripts/diagnose-sale-display.mjs
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: settings } = await supabase
    .from("site_settings")
    .select("feature_flags")
    .eq("id", 1)
    .maybeSingle()
  const toggleOn = settings?.feature_flags?.sale_promotion_enabled === true
  console.log(`Global toggle (sale_promotion_enabled): ${toggleOn ? "ON" : "OFF"}\n`)

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, compare_at_price, metadata, status, variants(price, compare_at_price)")

  if (error) {
    console.error(error)
    process.exit(1)
  }

  const pathA = []
  const pathB = []

  for (const p of products) {
    const meta = p.metadata || {}
    const onSale = meta.on_sale === true
    const sp = Number(meta.sales_price ?? meta.sale_price)
    if (onSale && Number.isFinite(sp) && sp > 0) {
      pathA.push({ name: p.name, status: p.status, sp })
    }

    const variants = p.variants || []
    if (variants.length > 0) {
      const sorted = [...variants].sort((a, b) => Number(a.price) - Number(b.price))
      const v = sorted[0]
      const vp = Number(v.price)
      const vc = v.compare_at_price != null ? Number(v.compare_at_price) : null
      if (vc != null && Number.isFinite(vc) && vc > vp) {
        pathB.push({ name: p.name, status: p.status, price: vp, compare: vc })
      }
    } else {
      const pp = Number(p.price)
      const pc = p.compare_at_price != null ? Number(p.compare_at_price) : null
      if (pc != null && Number.isFinite(pc) && pc > pp) {
        pathB.push({ name: p.name, status: p.status, price: pp, compare: pc, noVariants: true })
      }
    }
  }

  console.log(`Total products: ${products.length}`)
  console.log(`Active products: ${products.filter((p) => p.status === "active").length}\n`)

  console.log(`--- Path A: per-product on_sale (${pathA.length}) ---`)
  console.log(`These show as "on sale" only when the toggle is ON.`)
  for (const p of pathA.slice(0, 20)) console.log(`  ${p.status === "active" ? "★" : " "} ${p.name}  (sales_price=${p.sp})`)
  if (pathA.length > 20) console.log(`  ...and ${pathA.length - 20} more`)

  console.log(`\n--- Path B: variants/product compare_at_price > price (${pathB.length}) ---`)
  console.log(`These ALWAYS show as "on sale" — toggle has NO effect on these. <-- this is your problem`)
  for (const p of pathB.slice(0, 30)) {
    console.log(`  ${p.status === "active" ? "★" : " "} ${p.name}  price=${p.price}  compare_at=${p.compare}${p.noVariants ? "  (product-level)" : ""}`)
  }
  if (pathB.length > 30) console.log(`  ...and ${pathB.length - 30} more`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
