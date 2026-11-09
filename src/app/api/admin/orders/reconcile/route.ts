import { NextRequest, NextResponse } from "next/server"
import { requireStaffArea } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"
import { moolreConfigured } from "@/lib/moolre-status"
import { fulfillMoolrePaidOrder, ghanaPhoneFromPayer } from "@/lib/moolre-fulfill"
import { reconcileOrder, type ReconcileOrderRow, type ReconcileResult } from "@/lib/order-reconcile"

export const dynamic = "force-dynamic"
// A batch makes up to a few Moolre calls per order.
export const maxDuration = 120

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Orders per request; the page sends batches and shows progress. */
const MAX_BATCH = 20
/** Moolre lookups run this many orders at a time. */
const CONCURRENCY = 4

const ORDER_SELECT =
  "id, order_number, status, grand_total, created_at, notes, guest_email, guest_phone, payments(status, provider, provider_ref)"

function orderIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((v): v is string => typeof v === "string" && UUID.test(v)))].slice(0, MAX_BATCH)
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return out
}

/**
 * POST { action: "check", orderIds }   → asks Moolre about each order; changes nothing.
 * POST { action: "confirm", orderIds, notify } → re-checks each order with Moolre and
 *   records the payment only where Moolre confirms the full amount was paid.
 * The page decides which orders to send; the server never trusts its verdicts.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffArea(request, "orders")
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const limited = checkRateLimit(`reconcile:${getClientIdentifier(request)}`, { maxRequests: 60, windowSeconds: 60 })
  if (!limited.success) {
    return NextResponse.json({ error: "Too many checks at once. Wait a minute and try again." }, { status: 429 })
  }

  if (!moolreConfigured()) {
    return NextResponse.json(
      { error: "Moolre is not connected on this store, so payments can't be checked." },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as { action?: unknown; orderIds?: unknown; notify?: unknown }
  const action = body.action === "confirm" ? "confirm" : body.action === "check" ? "check" : null
  const ids = orderIds(body.orderIds)
  if (!action || ids.length === 0) {
    return NextResponse.json({ error: "Send an action (check or confirm) and up to 20 order ids." }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from("orders").select(ORDER_SELECT).in("id", ids)
  if (error) {
    console.error("[reconcile] order lookup failed:", error.message)
    return NextResponse.json({ error: "Could not load those orders." }, { status: 500 })
  }
  const orders = (data || []) as unknown as ReconcileOrderRow[]

  const checked = await inBatches(orders, CONCURRENCY, (order) => reconcileOrder(order))

  if (action === "check") {
    // The raw Moolre record stays on the server.
    const results: ReconcileResult[] = checked.map((r) => ({
      orderId: r.orderId,
      orderNumber: r.orderNumber,
      verdict: r.verdict,
      shownAs: r.shownAs,
      orderTotal: r.orderTotal,
      paidAmount: r.paidAmount,
      transactionId: r.transactionId,
    }))
    return NextResponse.json({ results })
  }

  const notify = body.notify === true
  const byId = new Map(orders.map((o) => [o.id, o]))
  const confirmed: { orderId: string; orderNumber: string; ok: boolean; message: string }[] = []
  for (const result of checked) {
    const order = byId.get(result.orderId)
    if (!order) continue
    if (result.verdict !== "paid_not_recorded" || result.paidAmount == null) {
      confirmed.push({
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        ok: false,
        message: "Moolre no longer shows a full payment for this order, so it was left as it is.",
      })
      continue
    }
    const outcome = await fulfillMoolrePaidOrder(supabase, {
      orderNumber: order.order_number,
      paidAmount: result.paidAmount,
      providerRef: String(result.transactionId || `reconcile-${order.order_number}`),
      rawPayload: result.tx,
      email: order.guest_email,
      phone: order.guest_phone || ghanaPhoneFromPayer(result.tx?.payer),
      notify,
    })
    confirmed.push({ orderId: order.id, orderNumber: order.order_number, ok: outcome.ok, message: outcome.message })
  }
  return NextResponse.json({ confirmed })
}
