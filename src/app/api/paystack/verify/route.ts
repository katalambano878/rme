import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { reduceOrderStock } from "@/lib/order-stock"

const PAID_FULFILLMENT_STATUSES = [
  "paid",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
] as const

function isPaidFulfillment(status: string): boolean {
  return (PAID_FULFILLMENT_STATUSES as readonly string[]).includes(status)
}

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference")
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 })
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: "Paystack not configured" }, { status: 500 })
  }

  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const data = await res.json()

    if (!data.status) {
      return NextResponse.json({ error: data.message || "Verification failed" }, { status: 502 })
    }

    const tx = data.data
    const supabase = createAdminClient()

    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, grand_total, status")
      .eq("order_number", reference)
      .maybeSingle()

    const { data: payment } = await supabase
      .from("payments")
      .select("id, status")
      .eq("provider_ref", reference)
      .maybeSingle()

    if (tx.status === "success") {
      if (order && isPaidFulfillment(order.status)) {
        return NextResponse.json({
          verified: true,
          status: "success",
          order_number: reference,
          amount: tx.amount / 100,
          currency: tx.currency,
        })
      }

      if (payment?.status === "paid") {
        return NextResponse.json({
          verified: true,
          status: "success",
          order_number: reference,
          amount: tx.amount / 100,
          currency: tx.currency,
        })
      }

      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
      }

      const paystackAmount = tx.amount / 100
      const expectedAmount = Number(order.grand_total)
      if (Math.abs(paystackAmount - expectedAmount) > 0.01) {
        return NextResponse.json(
          { error: "Payment amount does not match order total" },
          { status: 409 },
        )
      }

      await supabase
        .from("payments")
        .update({
          status: "paid",
          raw_payload: tx,
          updated_at: new Date().toISOString(),
        })
        .eq("provider_ref", reference)
        .neq("status", "paid")

      await supabase
        .from("orders")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("order_number", reference)
        .eq("status", "pending")

      try {
        const stockResult = await reduceOrderStock(supabase, order.id)
        if (stockResult.errors.length) {
          console.error("Paystack verify stock reduction errors:", stockResult.errors)
        }
      } catch (stockErr) {
        console.error("Paystack verify stock reduction crashed (non-fatal):", stockErr)
      }

      return NextResponse.json({
        verified: true,
        status: "success",
        order_number: reference,
        amount: paystackAmount,
        currency: tx.currency,
      })
    }

    if (payment?.status !== "paid") {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          raw_payload: tx,
          updated_at: new Date().toISOString(),
        })
        .eq("provider_ref", reference)
        .neq("status", "paid")
    }

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
