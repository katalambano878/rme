import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit"

/**
 * Initiate Moolre payment link for an existing order.
 * Amount is always taken from the database (grand_total), never from the client.
 * @see https://docs.moolre.com embed/link
 */
export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req)
    const rateLimitResult = checkRateLimit(`payment:${clientId}`, RATE_LIMITS.payment)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimitResult.resetIn),
          },
        },
      )
    }

    const body = await req.json()
    const { orderId, customerEmail } = body as { orderId?: string; customerEmail?: string }

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ success: false, message: "Missing or invalid orderId" }, { status: 400 })
    }

    if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY || !process.env.MOOLRE_ACCOUNT_NUMBER) {
      console.error("[Moolre] Missing MOOLRE_API_USER, MOOLRE_API_PUBKEY, or MOOLRE_ACCOUNT_NUMBER")
      return NextResponse.json({ success: false, message: "Payment gateway configuration error" }, { status: 500 })
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)

    const order = await queryOne<{
      id: string
      order_number: string
      grand_total: number
      guest_email: string | null
    }>(
      isUUID
        ? `SELECT id, order_number, grand_total, guest_email FROM orders WHERE id = $1 LIMIT 1`
        : `SELECT id, order_number, grand_total, guest_email FROM orders WHERE order_number = $1 LIMIT 1`,
      [orderId],
    )

    if (!order) {
      console.error("[Moolre] Order not found:", orderId)
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 })
    }

    const paymentsResult = await query<{ status: string }>(
      `SELECT status FROM payments WHERE order_id = $1`,
      [order.id],
    )
    const paid = paymentsResult.rows.some((p) => p.status === "paid" || p.status === "completed")
    if (paid) {
      return NextResponse.json({ success: false, message: "Order is already paid" }, { status: 400 })
    }

    const amount = Number(order.grand_total)
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, message: "Invalid order amount" }, { status: 400 })
    }

    const orderRef = order.order_number || orderId
    const requestUrl = new URL(req.url)
    let rawBase = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin
    if (rawBase && !rawBase.startsWith("http")) rawBase = `https://${rawBase}`
    const baseUrl = rawBase.replace(/\/+$/, "")

    const uniqueRef = `${orderRef}-R${Date.now()}`

    const payload: Record<string, unknown> = {
      type: 1,
      amount: amount.toString(),
      email: process.env.MOOLRE_MERCHANT_EMAIL || order.guest_email || "noreply@example.com",
      externalref: uniqueRef,
      callback: `${baseUrl}/api/payment/moolre/callback`,
      redirect: `${baseUrl}/checkout/success?order=${encodeURIComponent(orderRef)}&payment_success=true`,
      reusable: "0",
      currency: "GHS",
      accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
      metadata: {
        customer_email: customerEmail || order.guest_email,
        original_order_number: orderRef,
      },
    }

    if (process.env.MOOLRE_CALLBACK_SECRET) {
      payload.secret = process.env.MOOLRE_CALLBACK_SECRET
    }

    const existingPay = await queryOne<{ id: string }>(
      `SELECT id FROM payments WHERE order_id = $1 AND provider = 'moolre' LIMIT 1`,
      [order.id],
    )

    const pendingPayload = {
      provider_ref: uniqueRef,
      amount,
      raw_payload: { externalref: uniqueRef, original_order_number: orderRef },
    }

    if (existingPay?.id) {
      await query(
        `UPDATE payments
         SET provider_ref = $2, amount = $3, currency = 'GHS', status = 'pending',
             updated_at = now(), raw_payload = $4::jsonb
         WHERE id = $1 AND status <> 'paid'`,
        [existingPay.id, pendingPayload.provider_ref, pendingPayload.amount, JSON.stringify(pendingPayload.raw_payload)],
      )
    } else {
      await query(
        `INSERT INTO payments (order_id, provider, provider_ref, amount, currency, status, updated_at, raw_payload)
         VALUES ($1, 'moolre', $2, $3, 'GHS', 'pending', now(), $4::jsonb)`,
        [order.id, pendingPayload.provider_ref, pendingPayload.amount, JSON.stringify(pendingPayload.raw_payload)],
      )
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const response = await fetch("https://api.moolre.com/embed/link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-USER": process.env.MOOLRE_API_USER,
        "X-API-PUBKEY": process.env.MOOLRE_API_PUBKEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)

    const result = await response.json()

    if (result.status === 1 && result.data?.authorization_url) {
      return NextResponse.json({
        success: true,
        url: result.data.authorization_url,
        reference: result.data.reference || uniqueRef,
        externalref: uniqueRef,
      })
    }

    return NextResponse.json(
      { success: false, message: result.message || "Failed to generate payment link" },
      { status: 400 },
    )
  } catch (error: unknown) {
    console.error("[Moolre] Payment API error:", error)
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 })
  }
}
