-- Integrity: FKs for core commerce tables, unique order_number,
-- payment uniqueness (after dedupe), paid-status downgrade guards, indexes.
-- Safe for staging data that currently has zero orphans on these FKs.

-- ---------------------------------------------------------------------------
-- 0) Dedupe exact duplicate paid payment rows (same order + provider_ref)
-- Keep the newest id; mark older duplicates as failed so unique indexes apply.
-- ---------------------------------------------------------------------------
-- Collapse duplicate (provider, provider_ref) pairs: keep newest paid (else newest),
-- clear provider_ref on losers so a unique index can be applied.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY provider, coalesce(provider_ref, '')
           ORDER BY
             CASE WHEN status = 'paid' THEN 0 ELSE 1 END,
             created_at DESC NULLS LAST,
             id DESC
         ) AS rn
  FROM payments
  WHERE coalesce(provider_ref, '') <> ''
)
UPDATE payments p
SET status = CASE WHEN p.status = 'paid' AND d.rn > 1 THEN 'failed' ELSE p.status END,
    provider_ref = CASE WHEN d.rn > 1 THEN NULL ELSE p.provider_ref END,
    updated_at = now(),
    raw_payload = coalesce(p.raw_payload, '{}'::jsonb)
      || jsonb_build_object(
           'deduped_as', 'duplicate_provider_ref',
           'deduped_at', now(),
           'original_provider_ref', p.provider_ref
         )
FROM ranked d
WHERE p.id = d.id AND d.rn > 1;

-- ---------------------------------------------------------------------------
-- 1) Unique order_number (index existed but was non-unique)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_uidx
  ON public.orders (order_number);

-- ---------------------------------------------------------------------------
-- 2) Foreign keys (orphans verified empty before apply)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_id_fkey') THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_product_id_fkey') THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_variant_id_fkey') THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_variant_id_fkey
      FOREIGN KEY (variant_id) REFERENCES public.variants(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_id_fkey') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipments_order_id_fkey') THEN
    ALTER TABLE public.shipments
      ADD CONSTRAINT shipments_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'returns_order_id_fkey') THEN
    ALTER TABLE public.returns
      ADD CONSTRAINT returns_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_product_id_fkey') THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wishlists_product_id_fkey') THEN
    ALTER TABLE public.wishlists
      ADD CONSTRAINT wishlists_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_cart_id_fkey') THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_cart_id_fkey
      FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_variant_id_fkey') THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_variant_id_fkey
      FOREIGN KEY (variant_id) REFERENCES public.variants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Payment uniqueness going forward
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_ref_uidx
  ON public.payments (provider, provider_ref)
  WHERE provider_ref IS NOT NULL AND provider_ref <> '';

-- At most one paid payment per order (prevents double-charge bookkeeping)
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_paid_per_order_uidx
  ON public.payments (order_id)
  WHERE status = 'paid';

-- ---------------------------------------------------------------------------
-- 4) Prevent paid → non-paid status downgrades
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_paid_status_downgrade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    IF OLD.status IN ('paid','processing','shipped','out_for_delivery','delivered')
       AND NEW.status IN ('pending','cancelled')
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Refusing to downgrade order % from % to %', OLD.id, OLD.status, NEW.status;
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    -- Allow paid → refunded; block accidental unpaid/failed overwrites after success
    IF OLD.status = 'paid' AND NEW.status NOT IN ('paid', 'refunded') THEN
      RAISE EXCEPTION 'Refusing to change paid payment % to %', OLD.id, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_prevent_paid_downgrade ON public.orders;
CREATE TRIGGER orders_prevent_paid_downgrade
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_status_downgrade();

DROP TRIGGER IF EXISTS payments_prevent_paid_downgrade ON public.payments;
CREATE TRIGGER payments_prevent_paid_downgrade
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_status_downgrade();

-- ---------------------------------------------------------------------------
-- 5) Performance / lookup indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS orders_guest_email_idx ON public.orders (guest_email);
CREATE INDEX IF NOT EXISTS inventory_movements_order_ref_idx
  ON public.inventory_movements (reference_type, reference_id)
  WHERE reference_type = 'order';
DELETE FROM inventory_movements im
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY reference_type, reference_id, variant_id
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM inventory_movements
  WHERE reference_type = 'order' AND variant_id IS NOT NULL
) d
WHERE im.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_order_variant_uidx
  ON public.inventory_movements (reference_type, reference_id, variant_id)
  WHERE reference_type = 'order' AND variant_id IS NOT NULL;

-- Amount sanity
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_nonneg') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_amount_nonneg CHECK (amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_grand_total_nonneg') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_grand_total_nonneg CHECK (grand_total >= 0);
  END IF;
END $$;
