import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
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

    const supabase = createAdminClient()
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)

    const q = supabase
      .from("orders")
      .select("id, order_number, grand_total, guest_email, payments(status)")

    const { data: order, error: orderError } = isUUID
      ? await q.eq("id", orderId).single()
      : await q.eq("order_number", orderId).single()

    if (orderError || !order) {
      console.error("[Moolre] Order not found:", orderId)
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 })
    }

    const paid = (order.payments as { status: string }[] | null)?.some(
      (p) => p.status === "paid" || p.status === "completed",
    )
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
    if (rawBase && !rawBase.startsWith('http')) rawBase = `https://${rawBase}`
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

    // Include callback secret so Moolre echoes it back — required for signature verification
    if (process.env.MOOLRE_CALLBACK_SECRET) {
      payload.secret = process.env.MOOLRE_CALLBACK_SECRET
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    let result: {
      status?: number
      message?: string
      data?: { authorization_url?: string; reference?: string }
    }
    try {
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
      result = await response.json()
    } finally {
      clearTimeout(timeout)
    }

    if (result.status === 1 && result.data?.authorization_url) {
      // Persist the exact externalref used with Moolre so verify/callback can match.
      const { data: existingPay } = await supabase
        .from("payments")
        .select("id")
        .eq("order_id", order.id)
        .eq("provider", "moolre")
        .maybeSingle()

      const payRow = {
        order_id: order.id,
        provider: "moolre" as const,
        provider_ref: uniqueRef,
        amount,
        currency: "GHS",
        status: "pending" as const,
        updated_at: new Date().toISOString(),
        raw_payload: {
          moolre_reference: result.data.reference || null,
          externalref: uniqueRef,
        },
      }

      if (existingPay?.id) {
        await supabase.from("payments").update(payRow).eq("id", existingPay.id)
      } else {
        await supabase.from("payments").insert(payRow)
      }

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
