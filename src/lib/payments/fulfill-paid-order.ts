import { query, queryOne } from "@/lib/db"
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

  const paymentsResult = await query<{ id: string; status: string }>(
    `SELECT id, status FROM payments WHERE order_id = $1`,
    [input.orderId],
  )
  const payments = paymentsResult.rows

  const alreadyPaid = payments.some((p) => isPaidDb(p.status))
  if (alreadyPaid) {
    return { ok: true, alreadyPaid: true }
  }

  const dbStatus = toDbPaymentStatus("successful")
  const now = new Date().toISOString()

  const existingPay = await queryOne<{ id: string }>(
    `SELECT id FROM payments WHERE order_id = $1 AND provider = $2 LIMIT 1`,
    [input.orderId, input.provider],
  )

  if (existingPay?.id) {
    try {
      await query(
        `UPDATE payments
         SET provider_ref = $2,
             amount = $3,
             currency = $4,
             status = $5,
             updated_at = $6,
             raw_payload = $7::jsonb
         WHERE id = $1 AND status <> 'paid'`,
        [
          existingPay.id,
          input.providerRef,
          Number(input.expectedAmount),
          input.currency || "GHS",
          dbStatus,
          now,
          JSON.stringify(input.rawPayload ?? null),
        ],
      )
    } catch (e) {
      console.error(
        "[fulfillPaidOrder] payment update error:",
        e instanceof Error ? e.message : e,
      )
    }
  } else {
    try {
      await query(
        `INSERT INTO payments (order_id, provider, provider_ref, amount, currency, status, updated_at, raw_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          input.orderId,
          input.provider,
          input.providerRef,
          Number(input.expectedAmount),
          input.currency || "GHS",
          dbStatus,
          now,
          JSON.stringify(input.rawPayload ?? null),
        ],
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error("[fulfillPaidOrder] payment insert error:", message)
      if (!message.toLowerCase().includes("duplicate")) {
        return { ok: false, error: "Failed to record payment", statusCode: 500 }
      }
    }
  }

  let updatedOrderCount = 0
  try {
    const updatedOrders = await query<{ id: string }>(
      `UPDATE orders
       SET status = 'paid', updated_at = $2
       WHERE id = $1 AND status IN ('pending', 'awaiting_payment', 'processing')
       RETURNING id`,
      [input.orderId, now],
    )
    updatedOrderCount = updatedOrders.rows.length
  } catch (e) {
    console.error(
      "[fulfillPaidOrder] order update error:",
      e instanceof Error ? e.message : e,
    )
  }

  try {
    const stockResult = await reduceOrderStock(input.orderId)
    if (stockResult.errors.length) {
      console.error("[fulfillPaidOrder] stock errors:", stockResult.errors)
    }
  } catch (e) {
    console.error("[fulfillPaidOrder] stock crashed:", e)
  }

  // Only notify when we transitioned (or first success path). Soft: may duplicate under race —
  // notifications should become idempotent via sms_attempts table in a later pass.
  if (updatedOrderCount > 0) {
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
