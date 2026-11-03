import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyAccessToken } from "@/lib/db/auth"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"

/**
 * Signed-in customer's own orders.
 *
 * `orders` is not readable through the public REST shim, so the account page
 * calls this route with its bearer token. Orders match when they were placed
 * while signed in (user_id).
 */

const ORDER_SELECT = `
  id,
  order_number,
  status,
  grand_total,
  created_at,
  user_id,
  guest_email,
  payments(status),
  order_items(id, name_snapshot, quantity, unit_price, line_total, options_snapshot)
`

const MAX_ORDERS = 50

type OrderItemRow = {
  id: string
  name_snapshot: string | null
  quantity: number | string | null
  unit_price: number | string | null
  line_total: number | string | null
  options_snapshot: unknown
}

type OrderRow = {
  id: string
  order_number: string
  status: string
  grand_total: number | string | null
  created_at: string
  payments: { status: string }[] | null
  order_items: OrderItemRow[] | null
}

export async function GET(req: NextRequest) {
  const ip = getClientIdentifier(req)
  const rate = checkRateLimit(`account-orders:${ip}`, { maxRequests: 30, windowSeconds: 60 })
  if (!rate.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 },
    )
  }

  const header = req.headers.get("authorization") || ""
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : ""
  const verified = token ? await verifyAccessToken(token) : null
  if (!verified) {
    return NextResponse.json({ error: "Please sign in to see your orders." }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Orders are matched by account id only. Matching guest orders by email
  // would let anyone sign up with a customer's address and read their orders,
  // since sign-up does not verify the address.
  const userRes = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", verified.userId)
    .order("created_at", { ascending: false })
    .limit(MAX_ORDERS)
  if (userRes.error) {
    console.error("[account/orders] lookup failed:", userRes.error)
    return NextResponse.json({ error: "Could not load your orders. Please try again." }, { status: 500 })
  }

  const rows = ((userRes.data as OrderRow[] | null) || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_ORDERS)

  const orders = rows.map((o) => ({
    order_number: o.order_number,
    status: o.status,
    grand_total: Number(o.grand_total) || 0,
    created_at: o.created_at,
    is_paid: (o.payments || []).some(
      (p) => p.status === "paid" || p.status === "completed",
    ),
    items: (o.order_items || []).map((i) => ({
      id: i.id,
      name: i.name_snapshot,
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
      line_total: Number(i.line_total) || 0,
      options: i.options_snapshot ?? null,
    })),
  }))

  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } })
}
