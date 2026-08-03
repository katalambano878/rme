/**
 * Safe payment reconciliation — reports only unless --apply is passed.
 *
 * Usage:
 *   node scripts/reconcile-payments.mjs
 *   node scripts/reconcile-payments.mjs --apply
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: PAYSTACK_SECRET_KEY, MOOLRE_API_USER, MOOLRE_API_PUBKEY
 */

import { createClient } from "@supabase/supabase-js"

const APPLY = process.argv.includes("--apply")
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()

const { data: pending, error } = await supabase
  .from("payments")
  .select("id, order_id, provider, provider_ref, amount, status, created_at, orders(order_number, grand_total, status)")
  .eq("status", "pending")
  .lt("created_at", cutoff)
  .order("created_at", { ascending: true })
  .limit(100)

if (error) {
  console.error(error)
  process.exit(1)
}

console.log(`Pending payments older than 30m: ${(pending || []).length}`)
console.log(`Mode: ${APPLY ? "APPLY safe updates" : "REPORT ONLY"}`)

for (const p of pending || []) {
  const order = p.orders
  console.log("-".repeat(60))
  console.log({
    paymentId: p.id,
    provider: p.provider,
    providerRef: p.provider_ref,
    amount: p.amount,
    orderNumber: order?.order_number,
    orderStatus: order?.status,
    grandTotal: order?.grand_total,
  })

  if (!APPLY) continue

  // Apply path only marks failed when gateway confirms failure — never invents success.
  if (p.provider === "paystack" && process.env.PAYSTACK_SECRET_KEY && p.provider_ref) {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(p.provider_ref)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
    )
    const json = await res.json()
    const st = json?.data?.status
    if (st === "failed" || st === "abandoned") {
      await supabase.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", p.id)
      console.log("  -> marked failed from Paystack status", st)
    } else {
      console.log("  -> Paystack status", st, "(no auto success apply from this script)")
    }
  }
}

console.log("Done.")
