#!/usr/bin/env bash
# Apply plain-Postgres schema to staging DB store_trustecom.
# Safe to re-run (IF NOT EXISTS / additive migrations).
set -euo pipefail

REPO_ROOT="${1:-/tmp/trustecom-schema}"
source /data/fleet/secrets/store_trustecom.env
DB=store_trustecom
ROLE=store_trustecom

psql_db() {
  docker exec -i -e PGPASSWORD="$STORE_PASS" fleet-postgres \
    psql -v ON_ERROR_STOP=1 -U "$ROLE" -d "$DB" "$@"
}

echo "==> Confirm target"
psql_db -c "SELECT current_database() AS db, current_user AS role, version();"

echo "==> 000 auth stub"
psql_db < "$REPO_ROOT/db/migrations/000_auth_stub.sql"

echo "==> Extract core DDL from init_store (tables/enums/indexes; skip RLS/policies/storage)"
# Take lines until first "enable row level security" / helper role functions that use auth.uid heavily.
# We keep tables through login_audit_log, then skip RLS block.
INIT="$REPO_ROOT/supabase/migrations/20250324180000_init_store.sql"
TMP="$(mktemp)"
awk '
  /enable row level security/ { exit }
  /Helper: role checks/ { exit }
  { print }
' "$INIT" > "$TMP"
# Ensure store_name default is Trust Ecom for fresh installs
sed -i "s/default 'RonnyandMe'/default 'Trust Ecom'/g" "$TMP"
psql_db < "$TMP"
rm -f "$TMP"

echo "==> handle_new_user trigger on auth.users (plain)"
psql_db <<'SQL'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_super boolean;
  is_admin boolean;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', split_part(coalesce(NEW.email, 'user'), '@', 1)),
    'customer'
  )
  ON CONFLICT (id) DO UPDATE SET email = excluded.email;

  SELECT EXISTS (
    SELECT 1 FROM public.superadmins s WHERE lower(s.email) = lower(NEW.email)
  ) INTO is_super;
  IF is_super THEN
    UPDATE public.profiles SET role = 'superadmin' WHERE id = NEW.id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.store_admins s WHERE lower(s.email) = lower(NEW.email)
  ) INTO is_admin;
  IF is_admin AND NOT is_super THEN
    UPDATE public.profiles SET role = 'admin' WHERE id = NEW.id AND role = 'customer';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- App-layer authz helpers (always false without session JWT — use API auth)
CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.is_admin_or_above() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
SQL

echo "==> Additive column migrations"
for f in \
  20260413120000_categories_featured_and_parent.sql \
  20260413150000_products_admin_columns.sql \
  20260415120000_profiles_permissions_jsonb.sql \
  20260704183000_add_out_for_delivery_status.sql \
  20260803120000_rebrand_trust_ecom_defaults.sql \
  20260803140000_payment_integrity.sql
do
  echo "  -> $f"
  psql_db < "$REPO_ROOT/supabase/migrations/$f"
done

echo "==> Schema migrations bookkeeping"
psql_db <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.schema_migrations (id) VALUES
  ('000_auth_stub'),
  ('20250324180000_init_store_plain'),
  ('20260413120000_categories_featured_and_parent'),
  ('20260413150000_products_admin_columns'),
  ('20260415120000_profiles_permissions_jsonb'),
  ('20260704183000_add_out_for_delivery_status'),
  ('20260803120000_rebrand_trust_ecom_defaults'),
  ('20260803140000_payment_integrity')
ON CONFLICT (id) DO NOTHING;
SQL

echo "==> Seed Trust Ecom starter categories + settings"
psql_db < "$REPO_ROOT/supabase/seed.sql"

echo "==> Final inventory"
psql_db <<'SQL'
SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
SELECT id FROM public.schema_migrations ORDER BY applied_at;
SELECT store_name, support_email FROM public.storefront_settings WHERE id=1;
SELECT count(*) AS categories FROM public.categories;
SQL

echo "==> DONE store_trustecom schema applied"
