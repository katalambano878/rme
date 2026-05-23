/** Map `public.discounts` row to admin UI + chat coupon helpers (schema: init_store). */

export type DiscountRow = {
  id: string
  code: string
  description?: string | null
  discount_type: string
  value?: number | string | null
  min_spend?: number | string | null
  max_uses?: number | null
  uses_count?: number | null
  starts_at?: string | null
  ends_at?: string | null
  is_active?: boolean | null
}

export function discountRowToAdminCoupon(d: DiscountRow) {
  const typeLabel =
    d.discount_type === 'percent'
      ? 'Percentage'
      : d.discount_type === 'fixed'
        ? 'Fixed Amount'
        : d.discount_type === 'free_shipping'
          ? 'Free Shipping'
          : d.discount_type

  const now = new Date()
  const end = d.ends_at ? new Date(d.ends_at) : null
  const start = d.starts_at ? new Date(d.starts_at) : null
  const usageOk = d.max_uses == null || Number(d.uses_count ?? 0) < Number(d.max_uses)

  let status: 'Active' | 'Scheduled' | 'Expired' | 'Disabled' = 'Active'
  if (d.is_active === false) status = 'Disabled'
  else if (end && end < now) status = 'Expired'
  else if (start && start > now) status = 'Scheduled'
  else if (!usageOk) status = 'Expired'

  return {
    id: d.id,
    code: d.code,
    type: typeLabel,
    value: Number(d.value) || 0,
    minPurchase: Number(d.min_spend) || 0,
    usageLimit: d.max_uses ?? null,
    usedCount: Number(d.uses_count) || 0,
    startDate: d.starts_at ? new Date(d.starts_at).toLocaleDateString() : 'N/A',
    endDate: d.ends_at ? new Date(d.ends_at).toLocaleDateString() : null,
    status,
  }
}
