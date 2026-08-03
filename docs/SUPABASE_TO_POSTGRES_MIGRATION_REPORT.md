# Supabase → Plain Postgres Migration Report — Trust Ecom

**Report date:** 2026-08-03  
**Verdict:** Migration **not started** for runtime cutover. Foundation scaffolding only.

The application **continues to run entirely on Supabase Auth, PostgREST, Storage, and RLS**. A `pg` pool (`src/lib/db.ts`) and health endpoint exist but are **not** used for application queries except an optional ping in `/api/health`.

---

## Migration Matrix

| Feature | Previous (design intent) | Current state | Status | Remaining work |
|---------|--------------------------|---------------|--------|----------------|
| **Queries** | Supabase JS client (`@supabase/supabase-js`, `@supabase/ssr`) calling PostgREST | All runtime reads/writes still via Supabase clients in ~40+ files (storefront, admin, API routes). `src/lib/db.ts` exists but only consumed by `/api/health`. | **In progress** (foundation only) | Replace PostgREST with SQL via `pg` or Drizzle/Kysely; add repository layer; remove client-side DB access from admin pages. |
| **Auth** | Supabase Auth (`auth.users`, JWT cookies, middleware session refresh) | Fully active. Middleware, login/signup, `requireAdmin()`, profile RBAC unchanged. | **Not started** | Implement custom auth (e.g. Lucia, NextAuth + credentials, or fleet shared auth); migrate `profiles` FK off `auth.users`; password hash import or reset flow. |
| **RLS** | Postgres RLS policies on `public.*` enforced via anon/authenticated Supabase roles | Fully active for browser clients. Service role bypasses RLS on server routes. | **Not started** | Re-express authorization in application code + DB roles without Supabase JWT claims; drop or replace RLS for plain Postgres (mamator uses app-level checks). |
| **Storage** | Supabase Storage bucket `product-images` | Active. URLs built via `publicSupabaseProductImageUrl()` and admin uploads through Supabase Storage APIs. | **Not started** | Provision `/var/www/trustecom/uploads`; upload API route; migrate existing objects; update `product_images.storage_path` URLs; nginx static serving. |
| **Realtime** | Not used for database | No `.channel()` database subscriptions. Only auth state listener. | **N/A** | None required unless future live admin features added. |
| **RPC** | PostgREST `.rpc()` for server-side functions | Six RPCs called from app; **definitions not in local migrations** (remote Supabase only). | **Not started** | Export functions from Supabase; convert to SQL functions in plain schema or inline in TypeScript repositories. |
| **Edge Functions** | None planned in repo | No `supabase/functions/` directory; no edge deployments. | **N/A** | None. All logic in Next.js API routes. |
| **Cron** | No Supabase cron or Vercel cron in repo | Payment reconciliation is manual script (`scripts/reconcile-payments.mjs`). No scheduled jobs configured. | **Not started** | Add VPS cron or Coolify scheduled task for reconcile script; optional abandoned-cart / backup jobs. |
| **Email templates** | Inline HTML in `src/lib/notifications.ts` (Resend) | Active; brand updated to Trust Ecom. Not tied to Supabase. | **Complete** (provider-independent) | Optional: extract templates to files; no Supabase dependency to remove. |

---

## Status Legend

| Status | Meaning for Trust Ecom |
|--------|------------------------|
| **Not started** | Still 100% on Supabase for this concern |
| **In progress** | Prep work landed; runtime still on Supabase |
| **Complete** | No Supabase dependency for this concern |
| **N/A** | Never used or not applicable |

---

## Foundation Added (this session)

These items support a **future** cutover but do **not** constitute migration completion:

| Artifact | Purpose |
|----------|---------|
| `src/lib/db.ts` | Shared `pg` Pool; requires `DATABASE_URL` |
| `src/lib/env.ts` | Env validation for health checks |
| `GET /api/health` | Runtime env report + optional DB ping |
| `pg`, `@types/pg` in `package.json` | Postgres driver |
| `.env.example` → `DATABASE_URL` | Documented for VPS `store_*` DB |
| `supabase/migrations/20260803140000_payment_integrity.sql` | Still targets Supabase-hosted Postgres |

---

## VPS / Fleet State

| Item | Status |
|------|--------|
| Database `store_trustecom` on big VPS | **Not provisioned** |
| Coolify app for Trust Ecom | Unknown / not verified in this pass |
| Upload directory `/var/www/trustecom/uploads` | **Not created** |
| Mamator reference pattern | `store_mamator` + `DATABASE_URL` + local disk uploads |

---

## RPC Gap (blocks faithful schema export)

Functions used by the app but **absent from** `supabase/migrations/`:

1. `generate_ticket_number`
2. `mark_order_paid`
3. `get_support_dashboard_stats`
4. `get_ai_memories`
5. `upsert_customer_insight`
6. `upsert_chat_conversation`

Until these are captured, a plain Postgres restore from repo migrations alone will **break** support, POS, and chat features.

---

## Cutover Readiness Checklist

- [ ] Provision `store_trustecom` via `sudo fleet db provision trustecom`
- [ ] Apply full schema (init migrations + exported RPCs + remote-only tables)
- [ ] Data export from Supabase (pg_dump or table-by-table)
- [ ] Storage file migration to VPS disk
- [ ] Replace all `@supabase/*` runtime imports
- [ ] Auth replacement + session migration
- [ ] Update Coolify env: `DATABASE_URL`, remove Supabase vars
- [ ] Verify payments end-to-end on staging
- [ ] Update `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` with verification results

**Do not mark migration Complete until every runtime path is verified without Supabase.**

---

## Related Documents

- Playbook: [`SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md`](./SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md)
- System context: [`FULL_SYSTEM_AUDIT.md`](./FULL_SYSTEM_AUDIT.md)
- Session changes: [`REPAIR_CHANGELOG.md`](./REPAIR_CHANGELOG.md)
