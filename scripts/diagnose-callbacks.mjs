/**
 * Read-only diagnostic for the payment callbacks.
 * Verifies that all infra needed by /api/payment/moolre/callback and /checkout/callback
 * is in place in the live database.
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
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const tag = (ok, warn) => (ok ? "[ OK ]" : warn ? "[WARN]" : "[FAIL]")

console.log("==================== ENV VARS ====================")
const envs = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_BASE_URL: process.env.APP_BASE_URL,
  // Moolre
  MOOLRE_API_USER: process.env.MOOLRE_API_USER,
  MOOLRE_API_PUBKEY: process.env.MOOLRE_API_PUBKEY,
  MOOLRE_ACCOUNT_NUMBER: process.env.MOOLRE_ACCOUNT_NUMBER,
  MOOLRE_CALLBACK_SECRET: process.env.MOOLRE_CALLBACK_SECRET,
  // Paystack
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET,
  // Notifications
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  MOOLRE_SMS_API_KEY: process.env.MOOLRE_SMS_API_KEY,
}
for (const [k, v] of Object.entries(envs)) {
  const set = !!v && String(v).length > 0
  const warn = !set && (k === "PAYSTACK_SECRET_KEY" || k === "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY" || k === "APP_BASE_URL")
  console.log(`  ${tag(set, warn)}  ${k.padEnd(35)} ${set ? "set" : "(empty)"}`)
}

const appBase =
  (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "")
console.log(`\n  Resolved app base URL: ${appBase}`)
console.log(`  Moolre callback URL  : ${appBase}/api/payment/moolre/callback`)
console.log(`  Paystack callback URL: ${appBase}/checkout/callback?reference=ORD-…`)

console.log("\n==================== DB OBJECTS ====================")

async function tableHas(table, cols) {
  const { error } = await supabase.from(table).select(cols.join(",")).limit(1)
  return !error
}

const checks = [
  ["orders", ["id", "order_number", "status", "grand_total", "guest_email", "guest_phone", "shipping_address"]],
  ["payments", ["id", "order_id", "provider", "provider_ref", "status", "amount", "currency", "raw_payload"]],
  ["webhook_logs", ["id", "provider", "event_type", "payload", "headers", "status_code", "created_at"]],
]
for (const [tbl, cols] of checks) {
  const ok = await tableHas(tbl, cols)
  console.log(`  ${tag(ok)}  table public.${tbl} (${cols.length} cols expected)`)
}

console.log("\n==================== RPC FUNCTIONS ====================")
{
  const { error } = await supabase.rpc("reduce_order_stock", {
    p_order_id: "00000000-0000-0000-0000-000000000000",
  })
  const exists = !error || !/PGRST202|Could not find the function|does not exist/i.test(String(error?.message || ""))
  console.log(
    `  ${tag(exists)}  rpc.reduce_order_stock(p_order_id uuid)${exists ? "" : "  -> " + error?.message}`,
  )
}

console.log("\n==================== RECENT WEBHOOK_LOGS (Moolre) ====================")
{
  const { data, error } = await supabase
    .from("webhook_logs")
    .select("created_at, event_type, status_code, payload")
    .eq("provider", "moolre")
    .order("created_at", { ascending: false })
    .limit(10)
  if (error) {
    console.log(`  [FAIL] cannot read webhook_logs: ${error.message}`)
  } else if (data.length === 0) {
    console.log("  [WARN] No Moolre callbacks have ever been logged.")
    console.log("         If you have completed real payments, the callback URL may not be reachable.")
  } else {
    console.log(`  Found ${data.length} most-recent Moolre callback log(s):`)
    for (const row of data) {
      const ext = row.payload?.data?.externalref || row.payload?.externalref || "(no ref)"
      const st = row.payload?.status
      const tx = row.payload?.data?.txstatus ?? row.payload?.data?.txtstatus
      const msg = row.payload?.message
      console.log(
        `    ${row.created_at}  ext=${ext}  apiStatus=${st}  txStatus=${tx}  msg="${msg}"`,
      )
    }
  }
}

console.log("\n==================== ORDER STATUS HEALTH ====================")
{
  const { data, error } = await supabase
    .from("orders")
    .select("status")
  if (!error && data) {
    const counts = data.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    }, {})
    const total = data.length
    console.log(`  Total orders: ${total}`)
    for (const [s, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${s.padEnd(15)} ${n}`)
    }
  } else if (error) {
    console.log(`  [FAIL] cannot read orders: ${error.message}`)
  }
}

console.log("\n==================== RECENT PAID ORDERS WITH MOOLRE PAYMENTS ====================")
{
  const { data, error } = await supabase
    .from("payments")
    .select("provider, status, provider_ref, amount, currency, updated_at, orders(order_number, status)")
    .eq("provider", "moolre")
    .order("updated_at", { ascending: false })
    .limit(5)
  if (error) {
    console.log(`  [FAIL] ${error.message}`)
  } else if (data.length === 0) {
    console.log("  No Moolre payments have been recorded yet.")
  } else {
    for (const p of data) {
      console.log(
        `    ${p.updated_at}  ${p.orders?.order_number}  pay=${p.status}  order=${p.orders?.status}  ref=${p.provider_ref}  amt=${p.amount}${p.currency}`,
      )
    }
  }
}

console.log("\n==================== LIVE PROBE: Moolre callback endpoint ====================")
{
  const probeUrl = `${appBase}/api/payment/moolre/callback`
  try {
    // Hit it with a GET (which the route returns 405 for) — proves the route is reachable.
    const res = await fetch(probeUrl, { method: "GET" })
    if (res.status === 405) {
      console.log(`  [ OK ]  ${probeUrl} reachable; returns 405 to GET as expected.`)
    } else if (res.status === 404) {
      console.log(`  [FAIL]  ${probeUrl} returned 404 — endpoint not deployed at this URL.`)
    } else {
      console.log(`  [WARN]  ${probeUrl} returned ${res.status}.`)
    }
  } catch (e) {
    console.log(`  [WARN]  Could not reach ${probeUrl} from this script: ${e.message}`)
  }
}

console.log("\nDone.")
