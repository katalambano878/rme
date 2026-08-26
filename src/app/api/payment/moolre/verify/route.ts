import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit"
import { sendOrderConfirmation } from "@/lib/notifications"
import { reduceOrderStock } from "@/lib/order-stock"
import { amountMatchesOrder, verifyMoolrePayment } from "@/lib/moolre-status"

/**
 * Client-callable verification after redirect from Moolre (e.g. checkout success page).
 * Confirms payment via Moolre embed/status API, then updates `payments` + `orders`.
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

    const supabase = createAdminClient()

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, order_number, grand_total, guest_email, guest_phone, shipping_address, payments(status)")
      .eq("order_number", orderNumber.trim())
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 })
    }

    const paid = (order.payments as { status: string }[] | null)?.some(
      (p) => p.status === "paid" || p.status === "completed",
    )
    if (paid) {
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

    // Initiation stores provider_ref as `${orderNumber}-R{timestamp}`.
    // Probe that first, then fall back to bare order number for legacy rows.
    const { data: pendingPay } = await supabase
      .from("payments")
      .select("id, provider_ref")
      .eq("order_id", order.id)
      .eq("provider", "moolre")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const refsToTry = [pendingPay?.provider_ref, orderNumber.trim()].filter(
      (r): r is string => typeof r === "string" && r.length > 0,
    )

    const { ok, tx, matchedRef } = await verifyMoolrePayment(refsToTry)
    const paidAmount = parseFloat(String(tx?.amount ?? tx?.value ?? ""))
    const expected = Number(order.grand_total)
    const moolreApiVerified =
      ok && (Number.isNaN(paidAmount) || amountMatchesOrder(paidAmount, expected))

    if (!moolreApiVerified) {
      return NextResponse.json({
        success: false,
        message: "Payment not yet confirmed by payment provider",
      })
    }

    const payPayload = {
      order_id: order.id,
      provider: "moolre" as const,
      provider_ref: String(tx?.transactionid || matchedRef || pendingPay?.provider_ref || `verify-${orderNumber}`),
      amount: Number(order.grand_total),
      currency: "GHS",
      status: "paid" as const,
      updated_at: new Date().toISOString(),
    }

    if (pendingPay?.id) {
      await supabase.from("payments").update(payPayload).eq("id", pendingPay.id)
    } else {
      await supabase.from("payments").insert(payPayload)
    }

    await supabase
      .from("orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", order.id)

    // Reduce stock for each item in the order (idempotent, non-fatal).
    try {
      const stockResult = await reduceOrderStock(supabase, order.id)
      if (stockResult.skipped) {
        console.log("[Moolre verify] Stock reduction skipped (already reduced) for", orderNumber)
      } else {
        console.log(
          "[Moolre verify] Stock reduced for",
          orderNumber,
          "— items:",
          JSON.stringify(stockResult.items),
        )
        if (stockResult.errors.length) {
          console.error("[Moolre verify] Stock reduction errors:", stockResult.errors)
        }
      }
    } catch (stockErr: unknown) {
      console.error("[Moolre verify] Stock reduction crashed (non-fatal):", stockErr)
    }

    // Send notifications (best-effort; non-fatal if it fails)
    try {
      await sendOrderConfirmation({
        ...order,
        email: order.guest_email,
        phone: order.guest_phone,
        total: order.grand_total,
        created_at: new Date().toISOString(),
      })
    } catch (notifyErr: unknown) {
      console.error("[Moolre verify] Notification failed (non-fatal):", notifyErr)
    }

    return NextResponse.json({
      success: true,
      payment_status: "paid",
      message: "Payment verified and order updated",
    })
  } catch (error: unknown) {
    console.error("[Moolre verify] Error:", error)
    return NextResponse.json({ success: false, message: "Internal error" }, { status: 500 })
  }
}
