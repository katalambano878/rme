import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"

/**
 * Public order-tracking endpoint.
 *
 * The track-order page used to query the `orders` table directly from the
 * browser with the anon Supabase client. RLS on `orders` only allows the
 * logged-in owner (user_id = auth.uid()) or staff to read rows, so guest
 * customers ALWAYS got zero rows back and saw "Order not found" — even with
 * a perfectly valid order number. This server route uses the service-role
 * client to look the order up, but only returns it when the caller proves
 * ownership by supplying the email the order was placed with.
 */

export async function POST(req: NextRequest) {
  const ip = getClientIdentifier(req)
  const rate = checkRateLimit(`track-order:${ip}`, { maxRequests: 10, windowSeconds: 60 })
  if (!rate.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute and try again." },
      { status: 429 },
    )
  }

  let body: { orderNumber?: unknown; email?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

  if (!orderNumber || orderNumber.length > 64) {
    return NextResponse.json({ error: "Please enter your order number." }, { status: 400 })
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
  }

  const order = await queryOne<{
    id: string
    order_number: string
    status: string
    grand_total: number
    guest_email: string | null
    user_id: string | null
    created_at: string
    shipping_address: Record<string, unknown> | null
  }>(
    `SELECT id, order_number, status, grand_total, guest_email, user_id, created_at, shipping_address
     FROM orders
     WHERE order_number = $1
     LIMIT 1`,
    [orderNumber],
  )

  if (!order) {
    return NextResponse.json(
      { error: "Order not found. Please check your order number and try again." },
      { status: 404 },
    )
  }

  const guestEmail = (order.guest_email || "").toLowerCase()
  const shippingEmail = (
    (order.shipping_address?.email as string | undefined) || ""
  ).toLowerCase()

  let emailMatches = (!!guestEmail && guestEmail === email) || (!!shippingEmail && shippingEmail === email)

  if (!emailMatches && order.user_id) {
    const ownerProfile = await queryOne<{ email: string | null }>(
      `SELECT email FROM profiles WHERE id = $1 LIMIT 1`,
      [order.user_id],
    )
    const ownerEmail = (ownerProfile?.email || "").toLowerCase()
    emailMatches = !!ownerEmail && ownerEmail === email
  }

  if (!emailMatches) {
    return NextResponse.json(
      { error: "The email address does not match this order. Please use the email you placed the order with." },
      { status: 403 },
    )
  }

  const paymentsResult = await query<{ status: string }>(
    `SELECT status FROM payments WHERE order_id = $1`,
    [order.id],
  )
  const isPaid = paymentsResult.rows.some((p) => p.status === "paid" || p.status === "completed")

  const itemsResult = await query<{
    id: string
    name_snapshot: string
    sku_snapshot: string | null
    quantity: number
    unit_price: number
  }>(
    `SELECT id, name_snapshot, sku_snapshot, quantity, unit_price
     FROM order_items
     WHERE order_id = $1`,
    [order.id],
  )

  return NextResponse.json({
    order: {
      order_number: order.order_number,
      status: order.status,
      grand_total: order.grand_total,
      created_at: order.created_at,
      is_paid: isPaid,
      items: itemsResult.rows.map((i) => ({
        id: i.id,
        name: i.name_snapshot,
        sku: i.sku_snapshot,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    },
  })
}
