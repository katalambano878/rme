import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { query, queryOne } from "@/lib/db"
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

  // Record callback event early (idempotent via unique external_event_id when migration applied)
  const eventId = String(
    (event.data as { id?: string | number } | undefined)?.id ??
      `${event.event || "unknown"}:${(event.data as { reference?: string } | undefined)?.reference || "none"}`,
  )

  try {
    await query(
      `INSERT INTO callback_events (
         gateway, event_type, external_event_id, reference,
         payload_hash, signature_status, processing_status, raw_payload
       )
       VALUES ($1, $2, $3, $4, $5, 'valid', 'received', $6::jsonb)`,
      [
        "paystack",
        event.event || "unknown",
        eventId,
        (event.data as { reference?: string } | undefined)?.reference || null,
        createHmac("sha256", webhookSecret).update(rawBody).digest("hex"),
        JSON.stringify(event),
      ],
    )
  } catch {
    /* table may not exist yet or duplicate event; non-fatal */
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

      const order = await queryOne<{
        id: string
        order_number: string
        grand_total: number
        guest_email: string | null
        guest_phone: string | null
        shipping_address: unknown
        currency: string
      }>(
        `SELECT id, order_number, grand_total, guest_email, guest_phone, shipping_address, currency
         FROM orders
         WHERE order_number = $1
         LIMIT 1`,
        [reference],
      )

      if (!order) {
        console.error("[Paystack webhook] order not found", reference)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      const internal = normalizePaystackStatus("success")
      const paidAmount = Number(tx.amount || 0) / 100
      const expected = Number(order.grand_total)

      if (!amountsMatch(paidAmount, expected)) {
        console.error("[Paystack webhook] amount mismatch", { reference, paidAmount, expected })
        try {
          await query(
            `INSERT INTO webhook_logs (provider, event_type, payload)
             VALUES ('paystack', 'charge.success.amount_mismatch', $1::jsonb)`,
            [JSON.stringify(event)],
          )
        } catch {
          /* non-fatal */
        }
        return NextResponse.json({ received: true }, { status: 200 })
      }

      if (internal === "successful") {
        await fulfillPaidOrder({
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

      try {
        await query(
          `INSERT INTO webhook_logs (provider, event_type, payload)
           VALUES ('paystack', $1, $2::jsonb)`,
          [event.event || "unknown", JSON.stringify(event)],
        )
      } catch {
        /* non-fatal */
      }
    }
  } catch (err) {
    console.error("Paystack webhook processing error:", err)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
