# Repair Changelog — 2026-07-30

## Files changed (major)

### Auth / middleware
- **Deleted** root `middleware.ts` (dead; Next used `src/`)
- **Rewrote** `src/middleware.ts` — plain-PG JWT via `sb-access-token`, admin-only matcher, public payment/shim bypass
- `src/lib/db/auth.ts` — `adminCreateUser` / `adminDeleteUser`
- `src/lib/db/supabase-compat.ts` — `auth.admin.createUser/deleteUser`
- `src/app/api/admin/staff/route.ts` — auth via `supabaseAdmin` (no hosted anon client)

### Database / admin clients
- `src/lib/supabase/admin.ts` — mode-aware (`isPlainPostgres` → compat)
- `src/lib/supabase-admin.ts` — lazy Proxy (build-safe)
- `package.json` — moved `pg` to `dependencies`
- `supabase/migrations/20260730090000_plain_pg_rpc_compat.sql` — RPCs + indexes (**applied on `rme_staging`**)

### Payments / SMS
- `src/app/api/payment/moolre/route.ts` — persist `provider_ref`, timeout
- `src/app/api/payment/moolre/verify/route.ts` — verify correct externalref + amount
- `src/app/api/paystack/initialize/route.ts` — server-side shipping fee enforcement
- `src/lib/notifications.ts` — SMS timeout; quieter failure logs

### Support / POS / chat
- `src/app/api/support/tickets/route.ts` — schema-correct insert
- `src/app/api/support/tickets/[id]/messages/route.ts` — `support_messages`
- `src/app/admin/pos/page.tsx` — `reduceOrderStock` after `mark_order_paid`
- `src/app/api/chat/route.ts` — log RPC failures instead of empty catch

### Build hygiene
- **Deleted** legacy root `app/error.tsx` + `app/admin/error.tsx` (shadowed `src/app`)

### Docs
- `FULL_SYSTEM_AUDIT.md`
- `SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md`
- `PAYMENT_AND_CALLBACK_AUDIT.md`
- `PERFORMANCE_REPORT.md`
- This file

## Database migrations

| Migration | Staging | Prod-safe? |
|-----------|---------|------------|
| `20260730090000_plain_pg_rpc_compat.sql` | Applied | Yes — `CREATE OR REPLACE` / `IF NOT EXISTS` only |

## Packages

- **Moved:** `pg` → `dependencies`
- **Not removed yet:** `@supabase/*` (still required for browser Shape A)

## Manual actions required

1. Redeploy `rme-staging` with this commit.
2. Confirm Coolify env: `DATABASE_URL`, `NEXT_PUBLIC_USE_PLAIN_PG=true`, `NEXT_PUBLIC_SUPABASE_URL=<app origin>`, `AUTH_JWT_SECRET`.
3. Register Moolre/Paystack callback URLs for staging.
4. Smoke-test admin login, product edit/upload, checkout init (sandbox).
5. Do **not** send live SMS / live charges without approval.
