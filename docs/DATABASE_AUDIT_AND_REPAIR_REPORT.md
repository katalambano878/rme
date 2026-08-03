# Database Audit and Repair Report — Trust Ecom

**Report date:** 2026-08-03  
**Environment audited:** Staging on big VPS (`trustecom-staging` Coolify app)  
**Database:** `store_trustecom` (PostgreSQL 16.14 via `fleet-postgres` / `fleet-pgbouncer`)

---

## Executive summary

| Layer | Status |
|-------|--------|
| **Staging Postgres schema** | Applied — 32 `public` tables, seed data, payment integrity indexes |
| **Application runtime** | **Still Supabase** — `@supabase/ssr` + `@supabase/supabase-js` for CRUD, auth, storage |
| **Plain Postgres pool** | Present (`src/lib/db.ts`) — used only by `/api/health` via `db-health.ts` today |
| **Application cutover** | **NOT complete** — staging schema is ready for testing once queries are retargeted |

Do **not** treat this project as having completed a Supabase → Postgres cutover. The database on the VPS is provisioned and schema-ready; the Next.js app still expects Supabase PostgREST, Auth, and Storage at runtime.

---

## 1. Architecture (current vs target)

### 1.1 Current production path (runtime)

```
Browser / API routes
        │
        ▼
@supabase/ssr + @supabase/supabase-js
        │
        ├── Supabase Auth (sessions, JWT, auth.uid())
        ├── PostgREST (table CRUD via .from('…'))
        └── Supabase Storage (product-images, blog-covers, …)
        │
        ▼
Managed Supabase project (external)
```

Required env vars for runtime today (see `src/lib/env.ts`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Coolify **`trustecom-staging`** does **not** have Supabase env keys wired yet — only `DATABASE_URL` + `DIRECT_URL`.

### 1.2 Staging Postgres path (partially wired)

```
/api/health  ──►  src/lib/db-health.ts  ──►  src/lib/db.ts (pg Pool)
                                                    │
                                                    ▼
                                         store_trustecom @ fleet-postgres
                                         (via fleet-pgbouncer in app)
```

- **Database:** `store_trustecom`
- **Role:** `store_trustecom`
- **Secrets:** `/data/fleet/secrets/store_trustecom.env` on VPS
- **Connection:** Coolify app `trustecom-staging` (UUID `ok4shl2c5fhrbg22zs55yk3l`) has `DATABASE_URL` and `DIRECT_URL` set

### 1.3 Target architecture (not yet live)

```
Browser / API routes
        │
        ▼
src/lib/db.ts (pg Pool) + app-layer authz
        │
        ├── auth.users stub (plain Postgres) or custom auth tables
        ├── No RLS — middleware + role checks in API/server code
        └── Local disk uploads (/var/www/trustecom/uploads) instead of Storage
        │
        ▼
store_trustecom @ fleet-postgres
```

---

## 2. Baseline inventory

### 2.1 Staging database (`store_trustecom`)

| Property | Value |
|----------|-------|
| PostgreSQL | 16.14 |
| Host (direct) | `fleet-postgres` container |
| Host (app pool) | `fleet-pgbouncer` |
| Database | `store_trustecom` |
| Role | `store_trustecom` |
| Public tables | **32** |
| `store_name` | `Trust Ecom` |
| Seed categories | 4 (Featured, New Arrivals, Best Sellers, Sale) |
| RLS | **Not applied** on plain Postgres install |
| `auth.uid()` | Stub returns `NULL` |

Verify on VPS:

```bash
ssh big-vps './scripts/db-audit-baseline.sh'   # from repo copy on VPS, or inline psql
```

Or use `scripts/db-audit-baseline.sh` in this repo (expects VPS paths and secrets).

### 2.2 Application code expectations

| Expectation | Source | Staging PG match? |
|-------------|--------|-------------------|
| PostgREST `.from('table')` queries | ~50+ files under `src/` | Tables exist; client still points at Supabase |
| Supabase Auth sessions | `src/lib/auth.ts`, middleware, auth pages | **Mismatch** — stub `auth.users` only; no GoTrue |
| RLS policies (`auth.uid()`) | Original `init_store.sql` | **Not applied** — app must enforce authz |
| Storage buckets | `product-images`, etc. | **Not in PG** — needs local upload path |
| Support module tables | `/api/support/*` routes | **Not in schema** — no support migrations in repo |
| Payment tables + integrity | `payments`, `callback_events`, `sms_attempts` | **Applied** |

### 2.3 Related apps (do not confuse)

| Coolify app | Purpose |
|-------------|---------|
| **`trustecom-staging`** | This store — `store_trustecom` |
| **`rme-staging`** | Unrelated project — **different database and codebase** |

Always confirm `current_database() = 'store_trustecom'` before running DDL or restores.

---

## 3. Drift matrix

| Area | Code / runtime expects | Staging `store_trustecom` | Drift severity |
|------|------------------------|---------------------------|----------------|
| Data client | Supabase JS PostgREST | Plain Postgres + `pg` pool available | **High** — cutover not done |
| Auth | Supabase Auth + JWT + RLS | `auth.users` stub, `auth.uid()` → NULL, no RLS | **High** |
| Storage | Supabase Storage buckets | No `storage` schema | **High** |
| Core commerce schema | 29 tables from `init_store` | Present (plain DDL, no RLS block) | **Low** |
| Admin column additions | `products.*`, `categories.parent_id`, etc. | Applied via additive migrations | **None** |
| Payment integrity | Unique refs, `callback_events`, `sms_attempts` | Applied (`20260803140000`) | **None** |
| Support / chat tables | Used by API routes | **Missing** | **High** (feature-specific) |
| Supabase-only RPCs | e.g. ticket generators (if any on live Supabase) | Not exported to plain PG | **Unknown / High** |
| Env on Coolify staging | Both Supabase + DATABASE_URL | DATABASE_URL only today | **High** — app cannot fully run on PG alone yet |

---

## 4. Repairs completed (2026-08-03)

### 4.1 Schema apply to `store_trustecom`

Executed via `scripts/apply-store-trustecom-schema.sh`:

1. **`db/migrations/000_auth_stub.sql`** — `auth` schema, `auth.users`, no-op `auth.uid()`
2. **Core DDL** from `supabase/migrations/20250324180000_init_store.sql` (tables, enums, indexes through `login_audit_log`; **RLS/policies/storage skipped**)
3. **`handle_new_user` trigger** on `auth.users` + stub role helpers (`is_staff()` etc. always `false`)
4. **Additive migrations:**
   - `20260413120000_categories_featured_and_parent`
   - `20260413150000_products_admin_columns`
   - `20260415120000_profiles_permissions_jsonb`
   - `20260704183000_add_out_for_delivery_status`
   - `20260803120000_rebrand_trust_ecom_defaults`
   - `20260803140000_payment_integrity`
5. **`schema_migrations` bookkeeping** — 8 migration IDs recorded
6. **Seed** — `supabase/seed.sql` (4 categories, Trust Ecom settings)

### 4.2 Health check wiring

- `src/lib/db-health.ts` — verifies connectivity and 14 required tables
- `src/app/api/health/route.ts` — reports `database.status`, `tableCount`, `storeName`; honestly labels `primaryDataClient: "supabase-js"`

### 4.3 Integrity tooling

- `scripts/db-integrity-dry-run.sh` — read-only checks for duplicate payment refs, paid-order consistency, orphan line items

---

## 5. Remaining work (not done)

### 5.1 Application cutover (critical path)

1. Replace Supabase client calls with `src/lib/db.ts` repositories (incremental by domain: catalog → cart → orders → admin)
2. Implement real auth (sessions/JWT) replacing Supabase Auth; populate `auth.users` or migrate to dedicated `users` table
3. Enforce authorization in API routes (replacing RLS)
4. Replace Storage uploads with local filesystem + public URL base
5. Wire or migrate support/chat tables if those features stay in scope
6. Add Supabase env to Coolify **or** remove Supabase dependency entirely before staging is usable end-to-end

### 5.2 Data migration

- Export live Supabase data (products, orders, users, images metadata) and import into `store_trustecom`
- Remap `storage_path` URLs to local upload paths
- Reconcile `profiles.id` with new auth user IDs

### 5.3 Operations

- Schedule `pg_dump` backups (see `DATABASE_RECOVERY_GUIDE.md`)
- Run `db-integrity-dry-run.sh` after any data import
- Establish EXPLAIN baselines (see `DATABASE_PERFORMANCE_REPORT.md`)

---

## 6. Readiness assessment

| Gate | Ready? | Notes |
|------|--------|-------|
| VPS database provisioned | Yes | `store_trustecom` on fleet Postgres 16.14 |
| Schema matches core commerce DDL | Yes | 32 public tables |
| Payment integrity constraints | Yes | Unique indexes + audit tables |
| Coolify DATABASE_URL | Yes | `trustecom-staging` wired |
| App reads/writes via PG | **No** | Only health check uses `pg` |
| Auth works on PG | **No** | Stub only |
| Staging E2E testable | **Partial** | Schema + health OK; storefront needs query retarget |
| Production cutover | **No** | Runtime still Supabase |

**Honest status:** Staging Postgres **schema is ready for testing** once application queries are retargeted to `DATABASE_URL`. The Supabase cutover is **not** complete.

---

## 7. Verification commands

```bash
# On VPS — table count and migration IDs
source /data/fleet/secrets/store_trustecom.env
docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  psql -U store_trustecom -d store_trustecom -c \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public';"

docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  psql -U store_trustecom -d store_trustecom -c \
  "SELECT id, applied_at FROM schema_migrations ORDER BY applied_at;"

# Integrity dry-run (no writes)
bash scripts/db-integrity-dry-run.sh

# App health (when deployed)
curl -sS https://<trustecom-staging-host>/api/health | jq .
```

---

## 8. Related documents

| Document | Contents |
|----------|----------|
| [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) | All 32 tables, columns, FKs |
| [MIGRATION_STATUS_REPORT.md](./MIGRATION_STATUS_REPORT.md) | Applied migration IDs, apply/rollback |
| [SUPABASE_TO_POSTGRES_DATABASE_REPORT.md](./SUPABASE_TO_POSTGRES_DATABASE_REPORT.md) | Feature replacement matrix |
| [PAYMENT_DATABASE_AUDIT.md](./PAYMENT_DATABASE_AUDIT.md) | Paystack/Moolre DB layer |
| [DATABASE_PERFORMANCE_REPORT.md](./DATABASE_PERFORMANCE_REPORT.md) | Indexes and pool config |
| [DATABASE_RECOVERY_GUIDE.md](./DATABASE_RECOVERY_GUIDE.md) | Backup and restore |
