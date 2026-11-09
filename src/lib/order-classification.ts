// Shared by the admin orders page and the payment reconcile route, so both
// agree on which orders count as confirmed.

/**
 * Smart classifier — decides whether an order belongs in the "Confirmed" or
 * "Abandoned Carts" tab. The previous logic only checked the `payments` table,
 * which incorrectly flagged real sales as abandoned in three cases:
 *
 *   1. POS walk-in sales paid via MoMo (cashier received money in person; no
 *      payment row gets written until / unless the Moolre webhook fires).
 *   2. Online orders the admin manually advanced to processing/shipped/
 *      delivered (clearly fulfilled, but no `paid` payment row existed).
 *   3. Cash-on-delivery style flows added in the future.
 *
 * The new rules treat an order as confirmed if ANY of these are true:
 *   - it has a successful payment row (paid / completed)
 *   - the admin has advanced its status past `pending` (processing, shipped,
 *     delivered, completed) — i.e. someone is actively fulfilling it
 *   - it's a POS sale (the customer was physically at the counter)
 *
 * Only "still pending, never advanced, no payment recorded, not a POS sale"
 * shows up under Abandoned Carts now.
 */
export function isPosSale(order: { notes?: string | null; guest_email?: string | null }): boolean {
  const notes = (order.notes || '').toLowerCase();
  if (notes.startsWith('pos sale') || notes.includes('pos sale')) return true;
  if (notes.includes('pos checkout') || notes.includes('pos walk')) return true;
  if ((order.guest_email || '').toLowerCase() === 'pos-walkin@store.local') return true;
  return false;
}

export const FULFILLED_STATUSES = new Set([
  'paid',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'completed',
]);

export function classifyOrder(order: {
  status?: string | null;
  payments?: { status: string }[] | null;
  notes?: string | null;
  guest_email?: string | null;
}): { isPaid: boolean; isPos: boolean; isConfirmed: boolean } {
  const isPaid = !!order.payments?.some((p) => p.status === 'paid' || p.status === 'completed');
  const isPos = isPosSale({ notes: order.notes, guest_email: order.guest_email });
  const status = (order.status || '').toLowerCase();
  const advancedByAdmin = FULFILLED_STATUSES.has(status);

  const isConfirmed = isPaid || advancedByAdmin || isPos;
  return { isPaid, isPos, isConfirmed };
}
