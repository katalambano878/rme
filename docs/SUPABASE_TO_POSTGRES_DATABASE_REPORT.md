# Supabase → Postgres Database Report — Trust Ecom

**Report date:** 2026-08-03  
**Honest status:** Staging **schema** is on plain Postgres; **application cutover is NOT complete.**

---

## Migration matrix

| Feature | Previous (Supabase) | Replacement (VPS / app) | Status |
|---------|---------------------|-------------------------|--------|
| **PostgreSQL hosting** | Managed Supabase Postgres | `store_trustecom` on `fleet-postgres` 16.14 | **Schema ready** — DB provisioned, 32 tables |
| **Connection string** | Supabase pooler URL | `DATABASE_URL` + `DIRECT_URL` on Coolify `trustecom-staging` | **Wired** — app pool via `fleet-pgbouncer` |
| **PostgREST / `.from()` CRUD** | `@supabase/supabase-js` | `src/lib/db.ts` (`pg` Pool) + SQL | **Not started** — ~50+ files still use Supabase client |
| **Server components / RSC data** | `createClient()` from `@/lib/supabase/server` | Direct SQL or repository layer | **Not started** |
| **Middleware session** | `@supabase/ssr` cookie refresh | Custom session/JWT middleware | **Not started** |
| **Auth (signup/login)** | Supabase Auth (GoTrue) | `auth.users` stub + future app auth | **Stub only** — no real sessions on PG |
| **`auth.uid()` in SQL** | Real JWT claim | `auth.uid()` → `NULL` | **Stub** — RLS would deny all if enabled |
| **Row Level Security** | Policies on all public tables | App-layer authorization in API/routes | **Not applied** on VPS — required before production |
| **Service role bypass** | `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB role + explicit checks | **Not implemented** |
| **Storage: product images** | `storage.buckets` / `product-images` | Local disk e.g. `/var/www/trustecom/uploads` | **Not started** |
| **Storage: blog covers** | `blog-covers` bucket | Local disk | **Not started** |
| **Storage: receipts** | Private bucket | Local private path | **Not started** |
| **Realtime** | Not used | N/A | **N/A** |
| **Edge Functions** | Not used | N/A | **N/A** |
| **Database webhooks** | Supabase Dashboard | App cron / queue if needed | **Not planned** |
| **Schema migrations (DDL)** | Supabase CLI / Dashboard | `scripts/apply-store-trustecom-schema.sh` | **Done** on staging |
| **Migration tracking** | Supabase migration history | `public.schema_migrations` (8 IDs) | **Done** |
| **Seed data** | Supabase seed / manual | `supabase/seed.sql` on apply | **Done** — 4 categories, Trust Ecom settings |
| **Health check** | N/A | `/api/health` + `db-health.ts` | **Partial** — PG connectivity only |
| **Payment tables** | Supabase-hosted | Same DDL on `store_trustecom` | **Schema ready** — app still writes via Supabase |
| **Payment integrity indexes** | Migration on Supabase (if applied) | `20260803140000_payment_integrity` on VPS | **Applied** on staging |
| **`callback_events` audit** | Optional on Supabase | Table on VPS | **Applied** — code inserts via Supabase today |
| **`sms_attempts` audit** | Optional | Table on VPS | **Applied** |
| **Support module tables** | Likely on live Supabase | Not in repo migrations | **Missing** — routes will fail on PG-only |
| **Custom RPCs** | Supabase functions | Plain SQL functions or app code | **Not migrated** — inventory from live project needed |
| **Env: Supabase keys** | Required for runtime | Coolify staging: **not set yet** | **Gap** — staging cannot run full app without Supabase OR code cutover |
| **Env: DATABASE_URL** | N/A | Set on `trustecom-staging` | **Done** |
| **Backups** | Supabase automatic | Manual `pg_dump` via fleet | **Not scheduled** — see recovery guide |
| **Production cutover** | Supabase project | VPS Postgres + local uploads | **Not started** |

---

## Runtime client usage (code audit)

### Supabase (current primary)

Files importing `@supabase/*` or using `createClient` / `createAdminClient` / `supabaseAdmin` include:

- `src/lib/supabase/*`, `src/lib/supabase.ts`, `src/lib/supabase-admin.ts`
- `src/lib/auth.ts`, `src/middleware.ts`
- Payment routes: Paystack, Moolre
- Admin, support, chat, notifications, storefront layout, auth pages
- Most API routes under `src/app/api/`

**Health endpoint explicitly reports:** `primaryDataClient: "supabase-js"`

### Plain Postgres (current secondary)

| File | Usage |
|------|-------|
| `src/lib/db.ts` | Shared `pg` Pool — ready for adoption |
| `src/lib/db-health.ts` | Table presence check |
| `src/app/api/health/route.ts` | Dynamic import of db-health when `DATABASE_URL` set |

No other runtime routes use `@/lib/db` today.

---

## Environment variables

| Variable | Supabase era | Postgres era | Staging Coolify |
|----------|--------------|--------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Remove after cutover | **Not set** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Remove | **Not set** |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Remove | **Not set** |
| `DATABASE_URL` | Optional / future | Required | **Set** |
| `DIRECT_URL` | N/A | Migrations / admin | **Set** |
| `DATABASE_SSL` | N/A | Usually `false` internal | Check app env |
| `DATABASE_POOL_MAX` | N/A | Default 20 | Optional |

Defined in `src/lib/env.ts` — runtime health still requires Supabase vars until code is retargeted.

---

## Staging vs unrelated apps

| App | Database | Notes |
|-----|----------|-------|
| **trustecom-staging** | `store_trustecom` | This report |
| **rme-staging** | Different `store_*` DB | **Unrelated** — do not share credentials or restore targets |

---

## Recommended cutover phases

### Phase A — Schema (complete on staging)

- [x] Provision `store_trustecom`
- [x] Apply plain DDL + payment integrity
- [x] Seed Trust Ecom defaults
- [x] Wire `DATABASE_URL` on Coolify

### Phase B — Read path (not started)

- [ ] Catalog/search via `pg` behind feature flag
- [ ] Verify `/api/health` + integration tests against staging DB

### Phase C — Write path (not started)

- [ ] Orders, payments, inventory via `pg` + transactions
- [ ] Retarget Paystack/Moolre fulfillment to `query()` / `withTransaction()`

### Phase D — Auth & storage (not started)

- [ ] Replace Supabase Auth
- [ ] Local upload pipeline for images
- [ ] Remove `@supabase/*` from runtime imports

### Phase E — Production (not started)

- [ ] Data export/import from Supabase
- [ ] DNS cutover, backup schedule, integrity dry-run

---

## Completion criteria

The migration is **complete** only when:

1. Zero `@supabase/*` imports in runtime app code (routes, server components, middleware, client data layer)
2. All CRUD goes through `DATABASE_URL` (or successor repository layer)
3. Authorization enforced without RLS
4. Uploads served from local/VPS paths
5. Supabase env vars removed from Coolify
6. `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` updated with verification results

**Current state:** Phase A only. Staging Postgres schema is ready for testing once application queries are retargeted.

---

## Related documents

- [DATABASE_AUDIT_AND_REPAIR_REPORT.md](./DATABASE_AUDIT_AND_REPAIR_REPORT.md)
- [MIGRATION_STATUS_REPORT.md](./MIGRATION_STATUS_REPORT.md)
- [SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md](./SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md) — procedural guide (may lag this report)
