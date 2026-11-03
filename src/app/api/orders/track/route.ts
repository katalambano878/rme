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
 * ownership by supplying the email OR phone number the order was placed with
 * (checkout lets email be optional, so phone-only guests must be able to track).
 */

const NOT_FOUND_MESSAGE =
  "We couldn't find an order matching those details. Check your order number and the email or phone you used at checkout."

/** Last 9 digits, so 0244123456, 244123456 and +233244123456 all match. */
function phoneKey(value: unknown): string {
  const digits = typeof value === "string" || typeof value === "number" ? String(value).replace(/\D/g, "") : ""
  return digits.length >= 9 ? digits.slice(-9) : ""
}

function notFound() {
  // Same response for unknown order and wrong contact: no order-number oracle.
  return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 })
}

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

  let body: { orderNumber?: unknown; email?: unknown; phone?: unknown; contact?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : ""
  // Accept a single "contact" field (email or phone) or the explicit fields.
  const contactRaw =
    typeof body.contact === "string"
      ? body.contact.trim()
      : typeof body.email === "string" && body.email.trim()
        ? body.email.trim()
        : typeof body.phone === "string"
          ? body.phone.trim()
          : ""
  const isEmail = contactRaw.includes("@")
  const email = isEmail ? contactRaw.toLowerCase() : ""
  const phone = isEmail ? "" : phoneKey(contactRaw)

  if (!orderNumber || orderNumber.length > 64) {
    return NextResponse.json({ error: "Please enter your order number." }, { status: 400 })
  }
  if (contactRaw.length > 254) {
    return NextResponse.json({ error: "Please enter a valid email address or phone number." }, { status: 400 })
  }
  if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
  }
  if (!isEmail && !phone) {
    return NextResponse.json(
      { error: "Please enter the email address or phone number you used at checkout." },
      { status: 400 },
    )
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
      guest_phone,
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
    return notFound()
  }

  // Verify ownership: the supplied email/phone must match how the order was
  // placed. Guest checkouts store guest_email/guest_phone; the storefront also
  // snapshots both inside shipping_address; account orders resolve via the
  // profile.
  const shipping = (order.shipping_address as Record<string, unknown> | null) || {}
  let contactMatches = false

  if (isEmail) {
    const guestEmail = (order.guest_email || "").toLowerCase()
    const shippingEmail = (typeof shipping.email === "string" ? shipping.email : "").toLowerCase()
    contactMatches = (!!guestEmail && guestEmail === email) || (!!shippingEmail && shippingEmail === email)
  } else {
    contactMatches = [order.guest_phone, shipping.phone].some((p) => {
      const key = phoneKey(p)
      return !!key && key === phone
    })
  }

  if (!contactMatches && order.user_id) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email, phone")
      .eq("id", order.user_id)
      .maybeSingle()
    if (isEmail) {
      const ownerEmail = (ownerProfile?.email || "").toLowerCase()
      contactMatches = !!ownerEmail && ownerEmail === email
    } else {
      const ownerPhone = phoneKey(ownerProfile?.phone)
      contactMatches = !!ownerPhone && ownerPhone === phone
    }
  }

  if (!contactMatches) {
    return notFound()
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
      items: (
        (order.order_items as
          | { id: string; name_snapshot: string; sku_snapshot: string | null; quantity: number; unit_price: number }[]
          | null) || []
      ).map((i) => ({
        id: i.id,
        name: i.name_snapshot,
        sku: i.sku_snapshot,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    },
  })
}
