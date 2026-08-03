import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit"
import { fulfillPaidOrder, amountsMatch } from "@/lib/payments/fulfill-paid-order"
import { normalizeMoolreStatus } from "@/lib/payments/status"

/**
 * Client-callable verification after redirect from Moolre.
 * Confirms payment via Moolre embed/status using the stored externalref.
 */
export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req)
    const rateLimitResult = checkRateLimit(`verify:${clientId}`, RATE_LIMITS.payment)
    if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, message: "Too many requests" }, { status: 429 })
    }

    const { orderNumber } = (await req.json()) as { orderNumber?: string }

    if (!orderNumber || typeof orderNumber !== "string") {
      return NextResponse.json({ success: false, message: "Missing or invalid orderNumber" }, { status: 400 })
    }

    if (!/^ORD-/i.test(orderNumber.trim())) {
      return NextResponse.json({ success: false, message: "Invalid order number format" }, { status: 400 })
    }

    const cleanOrderNumber = orderNumber.trim().replace(/-R\d+$/, "")

    const order = await queryOne<{
      id: string
      order_number: string
      grand_total: number
      guest_email: string | null
      guest_phone: string | null
      shipping_address: unknown
    }>(
      `SELECT id, order_number, grand_total, guest_email, guest_phone, shipping_address
       FROM orders
       WHERE order_number = $1
       LIMIT 1`,
      [cleanOrderNumber],
    )

    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 })
    }

    const paymentsResult = await query<{ id: string; status: string; provider_ref: string | null }>(
      `SELECT id, status, provider_ref FROM payments WHERE order_id = $1`,
      [order.id],
    )
    const payments = paymentsResult.rows

    if (payments.some((p) => p.status === "paid" || p.status === "completed")) {
      return NextResponse.json({
        success: true,
        payment_status: "paid",
        message: "Order already paid",
      })
    }

    if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY) {
      return NextResponse.json(
        { success: false, message: "Payment verification unavailable" },
        { status: 503 },
      )
    }

    const moolrePay = payments.find((p) => p.provider_ref)
    const externalRefs = [
      moolrePay?.provider_ref,
      cleanOrderNumber,
      orderNumber.trim(),
    ].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i)

    let moolreApiVerified = false
    let paidAmount: number | null = null
    let usedRef = cleanOrderNumber

    for (const externalref of externalRefs) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 12_000)
        const checkResponse = await fetch("https://api.moolre.com/embed/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-USER": process.env.MOOLRE_API_USER,
            "X-API-PUBKEY": process.env.MOOLRE_API_PUBKEY,
          },
          body: JSON.stringify({ externalref }),
          signal: controller.signal,
        })
        clearTimeout(timer)

        const checkResult = (await checkResponse.json()) as {
          status?: number
          message?: string
          data?: { status?: string; amount?: string; txstatus?: number; txtstatus?: number }
        }

        const internal = normalizeMoolreStatus({
          apiStatus: checkResult.status,
          txStatus: checkResult.data?.txstatus ?? checkResult.data?.txtstatus,
          statusStr: checkResult.data?.status,
          message: checkResult.message,
        })

        if (internal === "successful") {
          if (checkResult.data?.amount) {
            paidAmount = parseFloat(checkResult.data.amount)
            if (!amountsMatch(paidAmount, Number(order.grand_total))) {
              continue
            }
          } else {
            paidAmount = Number(order.grand_total)
          }
          moolreApiVerified = true
          usedRef = externalref
          break
        }
      } catch (e) {
        console.warn("[Moolre verify] API error for", externalref, e)
      }
    }

    if (!moolreApiVerified || paidAmount === null) {
      return NextResponse.json({
        success: false,
        message: "Payment not yet confirmed by payment provider",
      })
    }

    const result = await fulfillPaidOrder({
      orderId: order.id,
      orderNumber: order.order_number,
      provider: "moolre",
      providerRef: usedRef,
      expectedAmount: Number(order.grand_total),
      paidAmount,
      guestEmail: order.guest_email,
      guestPhone: order.guest_phone,
      shippingAddress: order.shipping_address,
      rawPayload: { verified_via: "embed/status", externalref: usedRef },
    })

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.error || "Fulfillment failed" },
        { status: result.statusCode || 500 },
      )
    }

    return NextResponse.json({
      success: true,
      payment_status: "paid",
      message: result.alreadyPaid ? "Order already paid" : "Payment verified and order updated",
    })
  } catch (error: unknown) {
    console.error("[Moolre verify] Error:", error)
    return NextResponse.json({ success: false, message: "Internal error" }, { status: 500 })
  }
}
