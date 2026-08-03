import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fulfillPaidOrder, amountsMatch } from "@/lib/payments/fulfill-paid-order"
import { normalizePaystackStatus } from "@/lib/payments/status"
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit"

export async function GET(req: NextRequest) {
  const clientId = getClientIdentifier(req)
  const rate = checkRateLimit(`paystack-verify:${clientId}`, RATE_LIMITS.payment)
  if (!rate.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const reference = req.nextUrl.searchParams.get("reference")
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 })
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: "Paystack not configured" }, { status: 500 })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        signal: controller.signal,
      },
    )
    clearTimeout(timer)
    const data = await res.json()

    if (!data.status) {
      return NextResponse.json({ error: data.message || "Verification failed" }, { status: 502 })
    }

    const tx = data.data
    const supabase = createAdminClient()
    const internal = normalizePaystackStatus(tx.status)

    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, grand_total, guest_email, guest_phone, shipping_address, currency")
      .eq("order_number", reference)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (internal === "successful") {
      const paidAmount = Number(tx.amount) / 100
      const expected = Number(order.grand_total)
      if (!amountsMatch(paidAmount, expected)) {
        console.error("[Paystack verify] amount mismatch", { reference, paidAmount, expected })
        return NextResponse.json({ error: "Payment amount does not match order" }, { status: 400 })
      }

      const currency = String(tx.currency || order.currency || "GHS").toUpperCase()
      if (currency !== String(order.currency || "GHS").toUpperCase()) {
        return NextResponse.json({ error: "Currency mismatch" }, { status: 400 })
      }

      const result = await fulfillPaidOrder(supabase, {
        orderId: order.id,
        orderNumber: order.order_number,
        provider: "paystack",
        providerRef: reference,
        expectedAmount: expected,
        paidAmount,
        currency,
        rawPayload: tx,
        guestEmail: order.guest_email,
        guestPhone: order.guest_phone,
        shippingAddress: order.shipping_address,
      })

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || "Fulfillment failed" },
          { status: result.statusCode || 500 },
        )
      }

      return NextResponse.json({
        verified: true,
        status: "success",
        order_number: reference,
        amount: paidAmount,
        currency,
        already_paid: Boolean(result.alreadyPaid),
      })
    }

    await supabase
      .from("payments")
      .update({
        status: "failed",
        raw_payload: tx,
        updated_at: new Date().toISOString(),
      })
      .eq("provider_ref", reference)
      .neq("status", "paid")

    return NextResponse.json({
      verified: false,
      status: tx.status,
      order_number: reference,
    })
  } catch (err) {
    console.error("Paystack verify error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
