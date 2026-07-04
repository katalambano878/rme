import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
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
  // Tight limit: order tracking is a low-frequency action, and this endpoint
  // must not become an order-number/email enumeration oracle.
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

  const supabase = createAdminClient()

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      status,
      grand_total,
      guest_email,
      user_id,
      created_at,
      shipping_address,
      payments(status),
      order_items(id, name_snapshot, sku_snapshot, quantity, unit_price)
    `,
    )
    .eq("order_number", orderNumber)
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json(
      { error: "Order not found. Please check your order number and try again." },
      { status: 404 },
    )
  }

  // Verify ownership: the supplied email must match how the order was placed.
  // Guest checkouts store it in guest_email; the storefront also snapshots it
  // inside shipping_address; account orders resolve via the profile email.
  const guestEmail = (order.guest_email || "").toLowerCase()
  const shippingEmail = (
    (order.shipping_address as Record<string, unknown> | null)?.email as string | undefined || ""
  ).toLowerCase()

  let emailMatches = (!!guestEmail && guestEmail === email) || (!!shippingEmail && shippingEmail === email)

  if (!emailMatches && order.user_id) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", order.user_id)
      .maybeSingle()
    const ownerEmail = (ownerProfile?.email || "").toLowerCase()
    emailMatches = !!ownerEmail && ownerEmail === email
  }

  if (!emailMatches) {
    return NextResponse.json(
      { error: "The email address does not match this order. Please use the email you placed the order with." },
      { status: 403 },
    )
  }

  const isPaid = ((order.payments as { status: string }[] | null) || []).some(
    (p) => p.status === "paid" || p.status === "completed",
  )

  // Return only what the tracking page needs — never the full address or
  // payment internals.
  return NextResponse.json({
    order: {
      order_number: order.order_number,
      status: order.status,
      grand_total: order.grand_total,
      created_at: order.created_at,
      is_paid: isPaid,
      items: ((order.order_items as any[]) || []).map((i) => ({
        id: i.id,
        name: i.name_snapshot,
        sku: i.sku_snapshot,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    },
  })
}
