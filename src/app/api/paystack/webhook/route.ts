import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { fulfillPaidOrder, amountsMatch } from "@/lib/payments/fulfill-paid-order"
import { normalizePaystackStatus } from "@/lib/payments/status"

export async function POST(req: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || secretKey
  if (!webhookSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  const rawBody = await req.text()

  const signature = req.headers.get("x-paystack-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 })
  }
  const hash = createHmac("sha512", webhookSecret).update(rawBody).digest("hex")
  if (hash !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let event: { event?: string; data?: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Record callback event early (idempotent via unique external_event_id when migration applied)
  const eventId = String(
    (event.data as { id?: string | number } | undefined)?.id ??
      `${event.event || "unknown"}:${(event.data as { reference?: string } | undefined)?.reference || "none"}`,
  )

  try {
    await supabase.from("callback_events").insert({
      gateway: "paystack",
      event_type: event.event || "unknown",
      external_event_id: eventId,
      reference: (event.data as { reference?: string } | undefined)?.reference || null,
      payload_hash: createHmac("sha256", webhookSecret).update(rawBody).digest("hex"),
      signature_status: "valid",
      processing_status: "received",
      raw_payload: event,
    })
  } catch {
    /* table may not exist yet; non-fatal */
  }

  try {
    if (event.event === "charge.success") {
      const tx = event.data as {
        reference?: string
        amount?: number
        currency?: string
      }
      const reference = String(tx.reference || "")
      if (!reference) {
        return NextResponse.json({ received: true }, { status: 200 })
      }

      const { data: order } = await supabase
        .from("orders")
        .select("id, order_number, grand_total, guest_email, guest_phone, shipping_address, currency")
        .eq("order_number", reference)
        .maybeSingle()

      if (!order) {
        console.error("[Paystack webhook] order not found", reference)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      const internal = normalizePaystackStatus("success")
      const paidAmount = Number(tx.amount || 0) / 100
      const expected = Number(order.grand_total)

      if (!amountsMatch(paidAmount, expected)) {
        console.error("[Paystack webhook] amount mismatch", { reference, paidAmount, expected })
        await supabase.from("webhook_logs").insert({
          provider: "paystack",
          event_type: "charge.success.amount_mismatch",
          payload: event,
        })
        return NextResponse.json({ received: true }, { status: 200 })
      }

      if (internal === "successful") {
        await fulfillPaidOrder(supabase, {
          orderId: order.id,
          orderNumber: order.order_number,
          provider: "paystack",
          providerRef: reference,
          expectedAmount: expected,
          paidAmount,
          currency: String(tx.currency || order.currency || "GHS"),
          rawPayload: tx,
          guestEmail: order.guest_email,
          guestPhone: order.guest_phone,
          shippingAddress: order.shipping_address,
        })
      }

      await supabase
        .from("webhook_logs")
        .insert({
          provider: "paystack",
          event_type: event.event,
          payload: event,
        })
        .then(() => {})
    }
  } catch (err) {
    console.error("Paystack webhook processing error:", err)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
