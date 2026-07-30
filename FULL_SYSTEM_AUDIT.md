# FULL SYSTEM AUDIT — RME Store

**Date:** 2026-07-30  
**Branch:** `staging/plain-postgres`  
**Staging:** https://rme-staging.169-58-8-203.sslip.io  
**DB:** `fleet-postgres` / `rme_staging`

---

## 1. Baseline (before repairs)

| Check | Result |
|-------|--------|
| Git branch | `staging/plain-postgres` @ `aa3da2d` |
| Uncommitted | migration guide, next.config CSP, service-worker |
| Staging homepage `/` | 200 |
| `/shop`, `/cart`, `/checkout` | 200 |
| `/rest/v1/products` | 200 (plain-PG PostgREST shim) |
| `/auth/v1/health` | 200 |
| Admin redirect | 307 → `/admin/login?next=...` (**src middleware active**) |
| Staging CSP | Still allowed `*.supabase.co` / `via.placeholder.com` (stale deploy vs local next.config) |
| Products in DB | 461 |
| Orders | 288 |
| Auth users | 2 (admin) |
| RPCs present | Only `handle_new_user` initially |
| Automated tests | None |
| Hubtel | Not implemented in this repo |

### Critical baseline defects

1. Dual middleware (`middleware.ts` root vs `src/middleware.ts`) — Next used **src**, which ignored `sb-access-token` and ran `getUser()` broadly.
2. Payment/order APIs used `@/lib/supabase/admin` (always hosted Supabase SDK) instead of in-process PG compat.
3. Missing Postgres RPCs used by chat, POS, support.
4. Moolre verify used bare `orderNumber` while initiation used `${order}-R{timestamp}`.
5. Support tickets wrote to non-existent `support_ticket_messages` / wrong columns.
6. Root `app/` stubs shadowed `src/app/` — local production build produced almost no routes.
7. `pg` was a **devDependency** (risk of missing driver in production installs).
8. Eager `supabaseAdmin` construction broke builds without env.

---

## 2. Architecture summary

| Layer | Implementation |
|-------|----------------|
| Framework | Next.js 16.2.1 / React 19.2.4 / TypeScript |
| Data plane | Shape A: supabase-js call sites → `src/lib/db/supabase-compat.ts` + `pg` pool when `DATABASE_URL` set |
| Auth | Plain-PG GoTrue shim (`src/lib/db/auth.ts`, `/auth/v1/*`) + JWT (`jose`) |
| Storage | Local disk shim `/storage/v1/*` (`STORAGE_ROOT`) |
| Payments | Moolre + Paystack (no Hubtel) |
| SMS | Moolre VAS API via `src/lib/notifications.ts` |
| Email | Resend |

---

## 3. Route inventory (high level)

- **Storefront pages:** `/`, `/shop`, `/product(s)/[slug]`, `/cart`, `/checkout` (+ callback/success), `/account`, `/auth/*`, `/blog`, `/collections`, `/contact`, policies, `/track-order`
- **Admin pages:** `/admin/*` (dashboard, products, orders, POS, customers, support, staff, SMS test, …)
- **Payment APIs:** `/api/payment/moolre`, `/callback`, `/verify`; `/api/paystack/initialize|verify|webhook`
- **Shims:** `/auth/v1/*`, `/rest/v1/*`, `/storage/v1/*`
- Full enumerated list lives in build output (~93 app routes after fix).

---

## 4. Authentication / authorization

| Path | Behavior after repair |
|------|------------------------|
| Admin login | Sets `sb-access-token`; middleware verifies JWT + `app_metadata.role` in plain-PG |
| Admin APIs | `requireAdmin` / `verifyAuth` via mode-aware `supabaseAdmin` |
| Staff create/delete | `auth.admin.createUser/deleteUser` implemented on PG compat |
| Payment callbacks | Explicitly excluded from auth gating |

---

## 5. Remaining risks

| Risk | Severity | Notes |
|------|----------|-------|
| Browser client still `@supabase/ssr` | Medium | Requires `NEXT_PUBLIC_SUPABASE_URL` = app origin |
| Chat route still constructs anon Supabase client for some auth | Medium | Works when URL is self-hosted; should fully migrate |
| Moolre callback secret optional when absent in payload | Medium | Logged warning; harden with provider confirmation |
| No automated tests | High | Manual/staging verification only |
| Account order tab mock data | Low | Documented in migration guide |
| Hubtel | N/A | Not in product |

---

## 6. Fixes applied (this audit)

See `REPAIR_CHANGELOG.md`. Staging DB migration `20260730090000_plain_pg_rpc_compat.sql` applied to `rme_staging`.

---

## 7. Final readiness

**Ready after listed manual actions** (redeploy staging with new code, confirm Coolify env trio, register callback URLs, smoke-test admin login + one sandbox payment per gateway).
