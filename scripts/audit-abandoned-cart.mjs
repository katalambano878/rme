/**
 * Read-only audit of the Abandoned Carts list in Admin > Orders.
 *
 * The list shows any order whose payments table has NO row with status
 * 'paid' or 'completed'. We check each one against:
 *   - the order itself (status field)
 *   - any payments rows attached (failed/pending/etc.)
 *   - webhook_logs for the same merchant order ref (Moolre callbacks)
 *
 * Anything we find that looks paid but is sitting in Abandoned is flagged.
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

// 1. Pull all orders + their payments + customer name
const { data: orders, error } = await supabase
  .from("orders")
  .select(`
    id,
    order_number,
    status,
    grand_total,
    guest_email,
    guest_phone,
    shipping_address,
    created_at,
    payments(status, provider, provider_ref, amount, updated_at)
  `)
  .order("created_at", { ascending: false })

if (error) {
  console.error(error)
  process.exit(1)
}

// 2. Apply the same rule the UI uses
const abandoned = orders.filter(
  (o) => !(o.payments || []).some((p) => p.status === "paid" || p.status === "completed"),
)

console.log(`Total orders:          ${orders.length}`)
console.log(`In abandoned list:     ${abandoned.length}`)
console.log(`In confirmed list:     ${orders.length - abandoned.length}\n`)

// 3. Pull all moolre webhook_logs to check against abandoned order refs
const { data: hooks } = await supabase
  .from("webhook_logs")
  .select("created_at, payload")
  .eq("provider", "moolre")
  .order("created_at", { ascending: false })

// Index hooks by stripped externalref
const hooksByRef = new Map()
for (const h of hooks || []) {
  const raw = h.payload?.data?.externalref || h.payload?.externalref
  if (!raw) continue
  const stripped = String(raw).replace(/-R\d+$/, "")
  if (!hooksByRef.has(stripped)) hooksByRef.set(stripped, [])
  hooksByRef.get(stripped).push(h)
}

// 4. Audit each abandoned order
console.log("==================== ABANDONED ORDERS — DETAILED AUDIT ====================\n")
const stuck = []
const noEvidence = []

for (const o of abandoned) {
  const customer =
    (o.shipping_address?.firstName || "") +
    " " +
    (o.shipping_address?.lastName || "")
  const name = customer.trim() || o.guest_email || o.guest_phone || "Guest"

  const callbacks = hooksByRef.get(o.order_number) || []
  const successfulCallback = callbacks.find((c) => {
    const apiOk = c.payload?.status === 1 || c.payload?.status === "1"
    const tx = c.payload?.data?.txstatus ?? c.payload?.data?.txtstatus
    const txOk = tx === 1 || tx === "1"
    const msg = String(c.payload?.message || "").toLowerCase()
    return (apiOk || txOk) && !msg.includes("fail") && !msg.includes("error")
  })

  const payRows = o.payments || []
  const flag =
    successfulCallback ||
    o.status === "paid" ||
    payRows.some((p) => p.status === "paid" || p.status === "completed")

  console.log(
    `${flag ? "  [SUSPICIOUS]" : "  [clean]     "}` +
    ` ${o.order_number}  ${o.created_at.replace("T", " ").slice(0, 19)}` +
    `  ${name.padEnd(28).slice(0, 28)}` +
    `  GH₵${Number(o.grand_total).toFixed(2).padStart(8)}` +
    `  status=${o.status}` +
    `  payments=[${payRows.map((p) => p.status).join(",") || "none"}]` +
    `  callbacks=${callbacks.length}${successfulCallback ? " (1 SUCCESSFUL)" : ""}`,
  )

  if (flag) {
    stuck.push({ order: o, callbacks, successfulCallback, name })
  } else {
    noEvidence.push(o)
  }
}

console.log("\n==================== SUMMARY ====================\n")
if (stuck.length === 0) {
  console.log("No abandoned orders have any evidence of payment.")
  console.log("All " + abandoned.length + " entries appear to be GENUINELY abandoned (customer never paid).")
} else {
  console.log(`Found ${stuck.length} order(s) in Abandoned that look suspicious:\n`)
  for (const s of stuck) {
    const o = s.order
    console.log(`  → ${o.order_number}`)
    console.log(`      customer:    ${s.name}`)
    console.log(`      total:       GH₵${Number(o.grand_total).toFixed(2)}`)
    console.log(`      order.status:${o.status}`)
    console.log(
      `      payments:    ${(o.payments || []).map((p) => `${p.provider}:${p.status}@${p.amount}`).join(" | ") || "(no rows)"}`,
    )
    console.log(`      moolre callbacks received: ${s.callbacks.length}`)
    if (s.successfulCallback) {
      const c = s.successfulCallback.payload
      console.log(`      ✦ HAS SUCCESSFUL CALLBACK on ${s.successfulCallback.created_at}`)
      console.log(`        message="${c.message}"  amount=${c.data?.amount}  moolre_ref=${c.data?.transactionid}`)
    }
    console.log("")
  }

  console.log(
    "Action recommendation: For each [SUSPICIOUS] order, click the green 'Verify payment' button\n" +
    "in the admin UI (or run /api/payment/moolre/verify) to re-check Moolre and move them to Confirmed if paid.",
  )
}

console.log(`\nGenuinely abandoned (no evidence of payment): ${noEvidence.length}`)
