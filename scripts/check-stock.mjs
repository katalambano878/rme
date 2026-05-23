/**
 * Quick read-only stock check.
 * Run: node scripts/check-stock.mjs
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const { data: products, error } = await supabase
  .from("products")
  .select("id, name, quantity, variants(stock_quantity, updated_at), updated_at")

if (error) {
  console.error(error)
  process.exit(1)
}

let totalProductLevel = 0
let totalVariantStock = 0
let nonZero = 0
let zero = 0
const recentlyTouchedVariantStock = []

for (const p of products) {
  totalProductLevel += Number(p.quantity || 0)
  const variants = p.variants || []
  const sum = variants.reduce((s, v) => s + Number(v.stock_quantity || 0), 0)
  totalVariantStock += sum
  if (sum > 0 || Number(p.quantity || 0) > 0) nonZero++
  else zero++
}

console.log(`Total products:                        ${products.length}`)
console.log(`Sum of products.quantity:              ${totalProductLevel}`)
console.log(`Sum of variants.stock_quantity:        ${totalVariantStock}`)
console.log(`Products with stock > 0 (anywhere):    ${nonZero}`)
console.log(`Products with stock == 0 (everywhere): ${zero}`)
console.log("")
console.log("First 15 products with their stock breakdown:")
for (const p of products.slice(0, 15)) {
  const variants = p.variants || []
  const sum = variants.reduce((s, v) => s + Number(v.stock_quantity || 0), 0)
  console.log(
    `  ${p.name}: product.quantity=${p.quantity}  variants_total=${sum}  (${variants.length} variant${variants.length === 1 ? "" : "s"})`,
  )
}
