#!/usr/bin/env bash
set -euo pipefail
source /data/fleet/secrets/db-stack.env
source /data/fleet/secrets/store_trustecom.env
export PGPASSWORD="${STORE_PASS}"

docker exec -e PGPASSWORD="$STORE_PASS" -i fleet-postgres \
  psql -U store_trustecom -d store_trustecom -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price numeric(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS compare_at_price numeric(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price numeric(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantity int NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moq int NOT NULL DEFAULT 1;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS sale_price numeric(12,2);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS featured_on_home boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions jsonb;

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='products' AND column_name IN ('price','sale_price','compare_at_price','quantity','metadata')
ORDER BY 1;
SQL
echo OK
