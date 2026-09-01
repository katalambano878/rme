import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit"
import { fulfillMoolrePaidOrder, ghanaPhoneFromPayer } from "@/lib/moolre-fulfill"
import { amountMatchesOrder, verifyMoolrePayment } from "@/lib/moolre-status"

/**
 * Client-callable verification after redirect from Moolre (e.g. checkout success page).
 * Confirms payment via Moolre status API, then updates `payments` + `orders`.
 * If the checkout row is missing, a paid order is recovered so admin still sees it.
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

    const trimmed = orderNumber.trim()
    if (!/^ORD-/i.test(trimmed)) {
      return NextResponse.json({ success: false, message: "Invalid order number format" }, { status: 400 })
    }

    if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY) {
      return NextResponse.json(
        { success: false, message: "Payment verification unavailable" },
        { status: 503 },
      )
    }

    const supabase = createAdminClient()

    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, grand_total, guest_email, guest_phone, payments(status)")
      .eq("order_number", trimmed)
      .maybeSingle()

    const paid = (order?.payments as { status: string }[] | null)?.some(
      (p) => p.status === "paid" || p.status === "completed",
    )
    if (paid) {
      return NextResponse.json({
        success: true,
        payment_status: "paid",
        message: "Order already paid",
      })
    }

    let pendingRef: string | null = null
    if (order?.id) {
      const { data: pendingPay } = await supabase
        .from("payments")
        .select("id, provider_ref")
        .eq("order_id", order.id)
        .eq("provider", "moolre")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      pendingRef = pendingPay?.provider_ref || null
    }

    const refsToTry = [pendingRef, trimmed].filter(
      (r): r is string => typeof r === "string" && r.length > 0,
    )

    const { ok, tx, matchedRef } = await verifyMoolrePayment(refsToTry)
    const paidAmount = parseFloat(String(tx?.amount ?? tx?.value ?? ""))
    if (!ok || !Number.isFinite(paidAmount) || paidAmount <= 0) {
      return NextResponse.json({
        success: false,
        message: "Payment not yet confirmed by payment provider",
      })
    }

    if (order && !amountMatchesOrder(paidAmount, Number(order.grand_total))) {
      return NextResponse.json({
        success: false,
        message: "Payment not yet confirmed by payment provider",
      })
    }

    const result = await fulfillMoolrePaidOrder(supabase, {
      orderNumber: trimmed,
      paidAmount,
      providerRef: String(tx?.transactionid || matchedRef || `verify-${trimmed}`),
      rawPayload: tx,
      email: order?.guest_email || null,
      phone: order?.guest_phone || ghanaPhoneFromPayer(tx?.payer),
    })

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      payment_status: "paid",
      message: result.message,
    })
  } catch (error: unknown) {
    console.error("[Moolre verify] Error:", error)
    return NextResponse.json({ success: false, message: "Internal error" }, { status: 500 })
  }
}
