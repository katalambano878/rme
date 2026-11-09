/**
 * Payment reconciliation for the admin orders page.
 *
 * An order can land in the wrong tab when Moolre took the money but its
 * callback never reached us (network blip, customer closed the tab before the
 * redirect). This module asks Moolre directly, for each order, whether a
 * payment went through, and sorts the answer into something an admin can act
 * on. It never changes data itself; the reconcile route does that, and only
 * for orders this check reports as paid.
 */

import { classifyOrder, FULFILLED_STATUSES } from "./order-classification"
import { amountMatchesOrder, isSuccessfulMoolreTx, lookupMoolreTransaction, type MoolreTx } from "./moolre-status"
import { stripRetrySuffix } from "./moolre-fulfill"

export type ReconcileOrderRow = {
  id: string
  order_number: string
  status: string | null
  grand_total: number | string
  created_at: string
  notes: string | null
  guest_email: string | null
  guest_phone: string | null
  payments: { status: string; provider: string | null; provider_ref: string | null }[] | null
}

export type ReconcileVerdict =
  /** Moolre has a successful payment for the full amount; the order isn't marked paid. */
  | "paid_not_recorded"
  /** Moolre has a successful payment, but for a different amount. Needs a person. */
  | "amount_mismatch"
  /** Moolre answered and has no successful payment. */
  | "unpaid"
  /** Moolre could not be reached or isn't configured, so we don't know. */
  | "unknown"
  /** Already has a paid payment row: nothing to do. */
  | "already_paid"
  /** POS sale: paid at the counter, not through Moolre. */
  | "pos"

export type ReconcileResult = {
  orderId: string
  orderNumber: string
  verdict: ReconcileVerdict
  /** Which tab the order shows in today. */
  shownAs: "confirmed" | "abandoned"
  orderTotal: number
  paidAmount: number | null
  transactionId: string | null
}

/** References Moolre may know the payment by: stored payment refs (retries add -R1, -R2…) and the order number. */
export function moolreRefsFor(order: Pick<ReconcileOrderRow, "order_number" | "payments">): string[] {
  const refs: string[] = []
  for (const p of order.payments || []) {
    if (p.provider !== "moolre" || !p.provider_ref) continue
    refs.push(p.provider_ref)
    refs.push(stripRetrySuffix(p.provider_ref))
  }
  refs.push(order.order_number)
  return [...new Set(refs.map((r) => r.trim()).filter(Boolean))]
}

/**
 * Decide what an order's Moolre lookups mean. `lookups` holds one answer per
 * reference tried; any successful payment wins, otherwise "unpaid" needs at
 * least one real answer from Moolre.
 */
export function decideVerdict(
  order: ReconcileOrderRow,
  lookups: { reached: boolean; tx: MoolreTx | null }[],
): Omit<ReconcileResult, "orderId" | "orderNumber" | "shownAs" | "orderTotal"> {
  const total = Number(order.grand_total) || 0
  const paidTx = lookups.find((l) => isSuccessfulMoolreTx(l.tx))?.tx ?? null
  if (paidTx) {
    const paidAmount = parseFloat(String(paidTx.amount ?? paidTx.value ?? ""))
    const transactionId = paidTx.transactionid != null ? String(paidTx.transactionid) : null
    if (Number.isFinite(paidAmount) && paidAmount > 0 && amountMatchesOrder(paidAmount, total)) {
      return { verdict: "paid_not_recorded", paidAmount, transactionId }
    }
    return { verdict: "amount_mismatch", paidAmount: Number.isFinite(paidAmount) ? paidAmount : null, transactionId }
  }
  const verdict: ReconcileVerdict = lookups.some((l) => l.reached) ? "unpaid" : "unknown"
  return { verdict, paidAmount: null, transactionId: null }
}

/** Orders worth asking Moolre about: everything not paid, except POS sales. */
export function needsMoolreCheck(order: ReconcileOrderRow): boolean {
  const { isPaid, isPos } = classifyOrder(order)
  return !isPaid && !isPos
}

/** Check one order against Moolre. Read-only. */
export async function reconcileOrder(order: ReconcileOrderRow): Promise<ReconcileResult & { tx: MoolreTx | null }> {
  const { isPaid, isPos, isConfirmed } = classifyOrder(order)
  const base = {
    orderId: order.id,
    orderNumber: order.order_number,
    shownAs: (isConfirmed ? "confirmed" : "abandoned") as "confirmed" | "abandoned",
    orderTotal: Number(order.grand_total) || 0,
  }
  if (isPaid) return { ...base, verdict: "already_paid", paidAmount: null, transactionId: null, tx: null }
  if (isPos) return { ...base, verdict: "pos", paidAmount: null, transactionId: null, tx: null }

  const lookups: { reached: boolean; tx: MoolreTx | null }[] = []
  for (const id of moolreRefsFor(order)) {
    const idtype: 1 | 2 = /^\d+$/.test(id) ? 2 : 1
    const answer = await lookupMoolreTransaction({ id, idtype })
    lookups.push(answer)
    if (isSuccessfulMoolreTx(answer.tx)) break
  }
  const decided = decideVerdict(order, lookups)
  const tx = lookups.find((l) => isSuccessfulMoolreTx(l.tx))?.tx ?? null
  return { ...base, ...decided, tx }
}

/** True for orders still waiting on payment, whose status a confirmed payment should move to "paid". */
export function statusAwaitsPayment(status: string | null | undefined): boolean {
  return !FULFILLED_STATUSES.has((status || "").toLowerCase())
}
