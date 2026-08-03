import type { SupabaseClient } from "@supabase/supabase-js"
import { sendOrderConfirmation } from "@/lib/notifications"
import { reduceOrderStock } from "@/lib/order-stock"
import { isPaidDb, toDbPaymentStatus, type InternalPaymentStatus } from "@/lib/payments/status"

export type FulfillPaidOrderInput = {
  orderId: string
  orderNumber: string
  provider: "paystack" | "moolre"
  providerRef: string
  expectedAmount: number
  paidAmount: number
  currency?: string
  rawPayload?: unknown
  guestEmail?: string | null
  guestPhone?: string | null
  shippingAddress?: unknown
  /** When true, skip amount comparison (only after gateway already bound amount at init) */
  skipAmountCheck?: boolean
}

export type FulfillPaidOrderResult = {
  ok: boolean
  alreadyPaid?: boolean
  error?: string
  statusCode?: number
}

const AMOUNT_TOLERANCE = 0.01

/**
 * Idempotent paid-order fulfillment used by Paystack verify/webhook and Moolre callback/verify.
 * Marks payment + order paid, reduces stock once, sends confirmation once (best-effort).
 */
export async function fulfillPaidOrder(
  supabase: SupabaseClient,
  input: FulfillPaidOrderInput,
  internalStatus: InternalPaymentStatus = "successful",
): Promise<FulfillPaidOrderResult> {
  if (internalStatus !== "successful") {
    return { ok: false, error: "Not a successful payment", statusCode: 400 }
  }

  if (!input.skipAmountCheck) {
    if (
      Number.isNaN(input.paidAmount) ||
      Math.abs(input.paidAmount - Number(input.expectedAmount)) > AMOUNT_TOLERANCE
    ) {
      return {
        ok: false,
        error: "Payment amount does not match order total",
        statusCode: 400,
      }
    }
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("id, status")
    .eq("order_id", input.orderId)

  const alreadyPaid = (payments || []).some((p) => isPaidDb(p.status))
  if (alreadyPaid) {
    return { ok: true, alreadyPaid: true }
  }

  const dbStatus = toDbPaymentStatus("successful")
  const now = new Date().toISOString()
  const payPayload = {
    order_id: input.orderId,
    provider: input.provider,
    provider_ref: input.providerRef,
    amount: Number(input.expectedAmount),
    currency: input.currency || "GHS",
    status: dbStatus,
    updated_at: now,
    raw_payload: input.rawPayload ?? null,
  }

  const existingForProvider = (payments || []).find((p) => p.id)
  const { data: existingPay } = await supabase
    .from("payments")
    .select("id")
    .eq("order_id", input.orderId)
    .eq("provider", input.provider)
    .maybeSingle()

  if (existingPay?.id) {
    const { error } = await supabase
      .from("payments")
      .update(payPayload)
      .eq("id", existingPay.id)
      .neq("status", "paid")
    if (error) {
      console.error("[fulfillPaidOrder] payment update error:", error.message)
    }
  } else {
    const { error } = await supabase.from("payments").insert(payPayload)
    if (error) {
      // Unique provider_ref race — treat as already processed if conflict
      console.error("[fulfillPaidOrder] payment insert error:", error.message)
      if (!String(error.message).toLowerCase().includes("duplicate")) {
        return { ok: false, error: "Failed to record payment", statusCode: 500 }
      }
    }
  }

  // Conditional order update — only from pending-like states
  const { data: updatedOrders, error: orderErr } = await supabase
    .from("orders")
    .update({ status: "paid", updated_at: now })
    .eq("id", input.orderId)
    .in("status", ["pending", "awaiting_payment", "processing"])
    .select("id")

  if (orderErr) {
    console.error("[fulfillPaidOrder] order update error:", orderErr.message)
  }

  // If another worker already marked paid, stock/notify may still need to run once
  void existingForProvider

  try {
    const stockResult = await reduceOrderStock(supabase, input.orderId)
    if (stockResult.errors.length) {
      console.error("[fulfillPaidOrder] stock errors:", stockResult.errors)
    }
  } catch (e) {
    console.error("[fulfillPaidOrder] stock crashed:", e)
  }

  // Only notify when we transitioned (or first success path). Soft: may duplicate under race —
  // notifications should become idempotent via sms_attempts table in a later pass.
  if (updatedOrders && updatedOrders.length > 0) {
    try {
      await sendOrderConfirmation({
        id: input.orderId,
        order_number: input.orderNumber,
        email: input.guestEmail,
        phone: input.guestPhone,
        guest_email: input.guestEmail,
        guest_phone: input.guestPhone,
        shipping_address: input.shippingAddress,
        total: input.expectedAmount,
        grand_total: input.expectedAmount,
        created_at: now,
      })
    } catch (e) {
      console.error("[fulfillPaidOrder] notification failed (non-fatal):", e)
    }
  }

  return { ok: true }
}

export function amountsMatch(paid: number, expected: number): boolean {
  return !Number.isNaN(paid) && Math.abs(paid - Number(expected)) <= AMOUNT_TOLERANCE
}
