-- App expects dedicated sale pricing + order item option snapshots.
-- These were never in init migrations but are used by storefront/admin/checkout.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_price numeric(12, 2);

ALTER TABLE public.variants
  ADD COLUMN IF NOT EXISTS sale_price numeric(12, 2);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS options_snapshot jsonb;
