# Migration Status Report — Trust Ecom

**Report date:** 2026-08-03  
**Target database:** `store_trustecom` (staging, big VPS)  
**Migration tool:** SQL scripts (not Supabase CLI on VPS)

---

## Summary

| Item | Status |
|------|--------|
| Staging schema applied | **Yes** — 2026-08-03 |
| `schema_migrations` rows | **8** IDs recorded |
| Supabase CLI `db push` on VPS | **Not used** |
| Application using PG for CRUD | **No** — runtime still Supabase |
| Rollback scripts | **Not provided** — manual restore from backup |

---

## 1. Migration tooling

### 1.1 Plain Postgres apply script (authoritative for VPS)

**File:** `scripts/apply-store-trustecom-schema.sh`

- Runs on VPS against `fleet-postgres` container
- Sources `/data/fleet/secrets/store_trustecom.env` for credentials
- Idempotent: uses `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`
- Skips RLS, storage buckets, and Supabase-specific policies

**Usage:**

```bash
# On VPS — clone or sync repo first
ssh big-vps
cd /path/to/trust-ecom   # or /tmp/trustecom-schema
bash scripts/apply-store-trustecom-schema.sh "$(pwd)"
```

Default repo path argument: `/tmp/trustecom-schema` if omitted.

### 1.2 Auth stub (runs first)

**File:** `db/migrations/000_auth_stub.sql`

- Creates `auth` schema and `auth.users`
- Installs no-op `auth.uid()`

### 1.3 Supabase migration files (source of truth for DDL)

**Directory:** `supabase/migrations/`

These files were authored for Supabase but are replayed selectively on plain Postgres. Not all files in the directory are applied to `store_trustecom`.

---

## 2. Applied migrations on `store_trustecom`

Recorded in `public.schema_migrations`:

| ID | Source file | Description |
|----|-------------|-------------|
| `000_auth_stub` | `db/migrations/000_auth_stub.sql` | Auth schema stub |
| `20250324180000_init_store_plain` | `supabase/migrations/20250324180000_init_store.sql` (truncated) | Core 29 tables, enums, indexes; no RLS/storage |
| `20260413120000_categories_featured_and_parent` | Same-named file | `featured_on_home`, `parent_id` on categories |
| `20260413150000_products_admin_columns` | Same-named file | Admin product columns (price, sku, tags, …) |
| `20260415120000_profiles_permissions_jsonb` | Same-named file | `profiles.permissions` jsonb |
| `20260704183000_add_out_for_delivery_status` | Same-named file | Enum value `out_for_delivery` |
| `20260803120000_rebrand_trust_ecom_defaults` | Same-named file | Trust Ecom branding defaults |
| `20260803140000_payment_integrity` | Same-named file | Payment indexes, `callback_events`, `sms_attempts` |

**Seed applied after migrations:** `supabase/seed.sql` (4 categories + settings; not tracked as a migration ID)

**Verify:**

```sql
SELECT id, applied_at FROM public.schema_migrations ORDER BY applied_at;
```

---

## 3. Supabase migrations NOT applied to `store_trustecom`

These exist in `supabase/migrations/` but are **excluded** from the plain Postgres apply script (Supabase-specific, historical catalog data, or superseded):

| File | Reason skipped |
|------|----------------|
| `20250407120000_seed_default_categories.sql` | Superseded by `supabase/seed.sql` Trust Ecom categories |
| `20250408130000_cleanup_legacy_categories.sql` | Legacy RonnyandMe catalog cleanup — N/A on fresh install |
| `20260413140000_ensure_storage_product_images_bucket.sql` | Supabase Storage — no `storage` schema on VPS |
| `20260414120000_catalog_skin_lip_and_more_categories.sql` | Brand-specific catalog — not Trust Ecom seed |
| `20260416120000_remove_six_categories_reassign_products.sql` | Legacy data migration |
| `20260429120000_lock_profiles_role_self_update.sql` | RLS policy only |

If production Supabase has additional ad-hoc migrations not in this repo, export and add them before data cutover.

---

## 4. How to apply (fresh or re-run)

### 4.1 Prerequisites

- VPS access: `ssh big-vps`
- Database provisioned: `sudo fleet db provision trustecom` (already done)
- Secrets: `/data/fleet/secrets/store_trustecom.env`
- Repo synced to VPS

### 4.2 Apply full schema

```bash
ssh big-vps 'bash /path/to/trust-ecom/scripts/apply-store-trustecom-schema.sh /path/to/trust-ecom'
```

Expected final output includes:

- `tables = 32` (public base tables)
- `store_name = Trust Ecom`
- `categories = 4`
- Eight rows in `schema_migrations`

### 4.3 Apply a single new migration (forward)

1. Add SQL file under `supabase/migrations/` or `db/migrations/`
2. Append filename to the `for f in …` loop in `apply-store-trustecom-schema.sh`
3. Add ID to the `INSERT INTO schema_migrations` block
4. Re-run script (safe for additive changes)

For non-idempotent DDL, take a backup first (see `DATABASE_RECOVERY_GUIDE.md`).

### 4.4 Post-apply checks

```bash
bash scripts/db-integrity-dry-run.sh
bash scripts/db-audit-baseline.sh
curl -sS https://<staging-host>/api/health | jq '.database'
```

---

## 5. Rollback notes

**There is no automated down-migration.** The apply script only moves forward.

### 5.1 Safe re-run

Re-running `apply-store-trustecom-schema.sh` is safe for already-applied objects (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING` on migration IDs).

### 5.2 Partial rollback (single migration)

Manual SQL required. Example — remove payment integrity objects (destructive if data exists):

```sql
-- Example only — destroys callback/SMS audit data
DROP TABLE IF EXISTS public.sms_attempts;
DROP TABLE IF EXISTS public.callback_events;
DROP INDEX IF EXISTS public.payments_provider_ref_unique;
DROP INDEX IF EXISTS public.payments_order_provider_paid_unique;
DELETE FROM public.schema_migrations WHERE id = '20260803140000_payment_integrity';
```

### 5.3 Full rollback

Restore from `pg_dump` backup taken before the change:

```bash
# See DATABASE_RECOVERY_GUIDE.md
pg_restore … store_trustecom
```

### 5.4 Nuclear reset (staging only)

```bash
# Drop and recreate DB — requires fleet/admin access; never on production without approval
sudo fleet db provision trustecom --force   # if supported; otherwise manual drop/create
bash scripts/apply-store-trustecom-schema.sh
```

---

## 6. Application cutover status (separate from schema migrations)

Schema migration **≠** application migration.

| Step | Schema | App code |
|------|--------|----------|
| Core tables on VPS | Done | Still queries Supabase |
| Payment integrity tables | Done | Inserts via Supabase client today |
| Auth | Stub table only | Supabase Auth |
| Storage | Not migrated | Supabase Storage |
| `DATABASE_URL` on Coolify | Wired | Only `/api/health` uses it |

**Next application phase:** Retarget data access from `@supabase/supabase-js` to `src/lib/db.ts` — tracked in `SUPABASE_TO_POSTGRES_DATABASE_REPORT.md`.

---

## 7. Related scripts

| Script | Purpose |
|--------|---------|
| `scripts/apply-store-trustecom-schema.sh` | Apply / refresh schema |
| `scripts/db-audit-baseline.sh` | Inventory tables, Coolify env key names |
| `scripts/db-integrity-dry-run.sh` | Read-only payment/order integrity report |
| `scripts/deploy-trustecom-staging.sh` | Trigger Coolify deploy for `trustecom-staging` |
