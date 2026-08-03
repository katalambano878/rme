# Trust Ecom — Full System Audit

**Audit date:** 2026-08-03  
**Brand:** Trust Ecom (rebrand from prior RonnyandMe / beauty-store defaults)  
**Stack:** Next.js 16 (App Router), React 19, Tailwind 4, Supabase (Auth + PostgREST + Storage + RLS)

> **Important:** The application is **still fully on Supabase**. Plain Postgres cutover has **not** been completed. Foundation code (`src/lib/db.ts`, `/api/health`) exists for a future VPS migration but is not wired into runtime data access.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (storefront + admin client components)                 │
│  └─ @supabase/ssr browser client (anon key, RLS enforced)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ PostgREST + Auth cookies
┌───────────────────────────▼─────────────────────────────────────┐
│  Supabase Project                                               │
│  • auth.users + profiles (RBAC)                                 │
│  • public.* tables with RLS policies                              │
│  • Storage bucket: product-images                                 │
│  • RPCs (some live in remote DB only — not in local migrations) │
└───────────────────────────┬─────────────────────────────────────┘
                            │ service role (server routes only)
┌───────────────────────────▼─────────────────────────────────────┐
│  Next.js API routes (/api/*)                                    │
│  • Paystack / Moolre payment flows                              │
│  • Chat (Groq), support, notifications                          │
│  • createAdminClient / supabaseAdmin bypass RLS where needed    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Paystack API        Moolre API          Resend + Moolre SMS
```

### Future (not live)

- `src/lib/db.ts` — `pg` Pool for `DATABASE_URL` (intended for `store_trustecom` on big VPS)
- `/api/health` — optional DB ping when `DATABASE_URL` is set
- `scripts/reconcile-payments.mjs` — operational script (still uses Supabase JS)

---

## 2. Route Inventory Summary

Routes were identified from the App Router file tree. **Page behavior was not runtime-tested** unless noted; most admin and authenticated flows are marked **Requires credentials / manual review**.

### Storefront (`src/app/(storefront)/`)

| Route | Type | Audit status |
|-------|------|--------------|
| `/` | Page | Static inspection only |
| `/shop` | Page + client | Static inspection only |
| `/collections` | Page + client | Static inspection only |
| `/products/[slug]` | Page + client | Static inspection only |
| `/cart` | Page + client | Static inspection only |
| `/checkout` | Page | Static inspection only; shipping hardcoded to 0 in UI |
| `/checkout/success` | Page | Static inspection only |
| `/checkout/callback` | Page | Static inspection only |
| `/track-order` | Page | Static inspection only |
| `/account` | Page | Requires credentials / manual review |
| `/auth/login` | Page | Requires credentials / manual review |
| `/auth/signup` | Page | Requires credentials / manual review |
| `/auth/callback` | Route handler | Static inspection only |
| `/about` | Page | Static inspection only |
| `/contact` | Page | Static inspection only |
| `/blog` | Page | Static inspection only |
| `/blog/[slug]` | Page | Static inspection only |
| `/policies/privacy` | Page | Static inspection only |
| `/policies/terms` | Page | Static inspection only |
| `/policies/shipping` | Page | Static inspection only |
| `/policies/returns` | Page | Static inspection only |

### Admin (`src/app/admin/`)

All admin pages except `/admin/login` are protected by middleware (Supabase session + `profiles.role` in `admin`, `staff`, or `superadmin`).

| Route | Audit status |
|-------|--------------|
| `/admin/login` | Static inspection only |
| `/admin` (dashboard) | Requires credentials / manual review |
| `/admin/orders`, `/admin/orders/[id]` | Requires credentials / manual review |
| `/admin/products`, `/admin/products/new`, `/admin/products/[id]` | Requires credentials / manual review |
| `/admin/inventory` | Requires credentials / manual review |
| `/admin/customers`, `/admin/customers/[id]` | Requires credentials / manual review |
| `/admin/pos` | Requires credentials / manual review |
| `/admin/analytics` | Requires credentials / manual review |
| `/admin/sales` | Requires credentials / manual review |
| `/admin/categories`, `/admin/coupons`, `/admin/reviews` | Requires credentials / manual review |
| `/admin/blog`, `/admin/blog/new`, `/admin/blog/[id]` | Requires credentials / manual review |
| `/admin/staff`, `/admin/roles`, `/admin/modules` | Requires credentials / manual review |
| `/admin/support/*` | Requires credentials / manual review |
| `/admin/notifications`, `/admin/customer-insights` | Requires credentials / manual review |
| `/admin/test-sms` | Requires credentials / manual review |

### API routes (`src/app/api/`)

| Route | Auth | Notes |
|-------|------|-------|
| `GET /api/health` | Public | Env + optional `DATABASE_URL` ping |
| `POST /api/paystack/initialize` | Public | Creates order; server-side pricing |
| `GET /api/paystack/verify` | Public | Rate limited |
| `POST /api/paystack/webhook` | Paystack HMAC | No session auth |
| `POST /api/payment/moolre` | Public | Rate limited |
| `POST /api/payment/moolre/callback` | `MOOLRE_CALLBACK_SECRET` | Rate limited |
| `POST /api/payment/moolre/verify` | Public | Rate limited |
| `GET /api/settings/delivery-fee` | Public | Reads `site_settings` |
| `GET/POST /api/orders/track` | Public | Order lookup |
| `POST /api/chat` | Public | Groq; rate limited |
| `POST /api/chat/transcribe`, `/speak` | Public | Rate limited |
| `POST /api/recaptcha/verify` | Public | |
| `GET /api/products/search` | Public | |
| `POST /api/notifications` | Admin token | Manual send |
| `/api/support/*` | `requireAdmin` | Tickets, KB, analytics |
| `POST /api/admin/staff` | Admin | Staff management |

---

## 3. Authentication & Authorization

### Current model (Supabase Auth)

- **Storefront customers:** Supabase email/password signup and login; sessions via `@supabase/ssr` cookies.
- **Admin/staff:** Same auth provider; role stored in `public.profiles.role` (`customer`, `staff`, `admin`, `superadmin`).
- **Middleware** (`src/middleware.ts`): Refreshes session; gates `/admin/*` and `/superadmin/*` by role.
- **API routes:** `requireAdmin()` / `verifyAuth()` in `src/lib/auth.ts` validate JWT from cookies or `Authorization: Bearer`.
- **Bootstrap:** `handle_new_user()` trigger + `superadmins` / `store_admins` allowlists (in init migration).

### RLS

- Init migration `20250324180000_init_store.sql` defines RLS on core tables.
- Many admin pages use the **browser anon client** and rely on RLS + staff role policies — not the service role.
- Server payment and fulfillment paths use **service role** (`createAdminClient`, `supabaseAdmin`) to bypass RLS for order/payment writes.

### Gaps / risks

- No custom session store; fully dependent on Supabase Auth until Postgres cutover.
- Admin client-side queries run under RLS — policy misconfiguration would leak or block data silently.
- `superadmin` route prefix referenced in middleware but no `/superadmin` pages found in repo.

---

## 4. Payments

### Providers

| Provider | Status | Entry points |
|----------|--------|--------------|
| **Paystack** | Active | `/api/paystack/initialize`, `/verify`, `/webhook` |
| **Moolre** | Active | `/api/payment/moolre`, `/callback`, `/verify` |
| **Hubtel** | **Not implemented** | No routes, env vars, or references |

### Shared fulfillment

- `src/lib/payments/fulfill-paid-order.ts` — idempotent mark-paid, stock reduction, confirmation SMS/email.
- `src/lib/payments/status.ts` — normalized status mapping for Paystack and Moolre.

### Fixes applied (this session, on Supabase stack)

1. **Moolre callback secret** — `MOOLRE_CALLBACK_SECRET` required; callbacks rejected if unset or mismatched.
2. **Paystack verify + webhook** — amount validation via `amountsMatch()`; successful charges call `fulfillPaidOrder` (stock + notifications).
3. **Shipping cost** — client `shippingCost` ignored in `/api/paystack/initialize`; fee loaded from `site_settings.feature_flags.delivery_fee` (default 25 GHS; pickup = 0).
4. **Moolre externalref** — stored on `payments.provider_ref` at link creation for later verify/status lookup.
5. **Server-side cart pricing** — Paystack initialize recomputes line prices from DB (no trusted client prices).

See `docs/PAYMENT_AND_CALLBACK_AUDIT.md` for flow diagrams and idempotency details.

---

## 5. SMS & Email

### Email (Resend)

- `src/lib/notifications.ts` — order confirmation, status updates, admin alerts.
- Requires `RESEND_API_KEY`, `EMAIL_FROM`; uses Trust Ecom branding from `src/lib/brand.ts`.
- Guest/placeholder emails filtered via `isDeliverableEmail()`.

### SMS (Moolre VAS)

- Same module; `sendSMS()` via `https://api.moolre.com/open/sms/send`.
- Keys: `MOOLRE_SMS_API_KEY` or fallback `MOOLRE_API_KEY`; sender `MOOLRE_SMS_SENDER_ID` (default `TrustEcom`).
- Admin numbers: `ADMIN_SMS_NUMBERS` (comma-separated).
- Migration `20260803140000_payment_integrity.sql` adds `sms_attempts` table — **logging not yet wired** in `sendSMS()`.

### Admin test

- `/admin/test-sms` — Requires credentials / manual review.

---

## 6. Performance (summary)

See `docs/PERFORMANCE_REPORT.md`. Highlights:

- Admin **orders**, **products**, **inventory**, **customers**, **analytics** load full datasets without server pagination.
- Rate limiting is **in-memory** (`src/lib/rate-limit.ts`) — ineffective across multiple instances.
- Storefront uses client PostgREST under RLS for several components.
- Hero references `/images/home/hero-*.png` (not present in repo at audit time); product images served from Supabase Storage without universal resize pipeline.
- **No Lighthouse baseline** was captured in this audit pass.

---

## 7. Security Findings

### Addressed

| Issue | Mitigation |
|-------|------------|
| Moolre callback spoofing | Mandatory `MOOLRE_CALLBACK_SECRET` |
| Paystack amount tampering | Server verify + webhook amount check |
| Client price manipulation | Server-side price recompute on checkout init |
| Client shipping fee manipulation | Ignored; DB/settings source of truth |
| Payment duplicate fulfillment | `fulfillPaidOrder` idempotency + DB unique indexes |

### Remaining risks

| Risk | Severity | Notes |
|------|----------|-------|
| RPCs not in repo migrations | Medium | Remote-only functions may drift from local schema |
| In-memory rate limits | Medium | Bypass under load balancer / multi-instance |
| Admin unpaginated queries | Medium | DoS / memory on large catalogs |
| SMS/email duplicate on race | Low | Comment in `fulfillPaidOrder`; `sms_attempts` not integrated |
| Chat API abuse | Medium | Rate limits exist but wallet (Groq) still exposed if limits fail |
| Service role in server routes | Expected | Key compromise = full DB access |
| RLS policy audit not repeated | Medium | Policies defined in init migration; not re-verified per table |
| `webhook_logs` / `callback_events` may grow unbounded | Low | No retention policy |
| Checkout UI shipping = 0 | Low UX | Server may charge delivery fee; UI mismatch |

---

## 8. Supabase-Specific Findings

### What is used

- **Auth** — sessions, signup, admin login
- **PostgREST** — all CRUD from client and most server routes
- **Storage** — `product-images` bucket (`src/lib/supabase-storage.ts`)
- **RLS** — enforced for anon/authenticated clients
- **RPC** — see below

### What is not used

- **Edge Functions** — none in repo (`supabase/functions/` absent)
- **Realtime subscriptions** — only `auth.onAuthStateChange().subscribe()` for session; no database realtime channels

### RPCs used in app but missing from local migrations

These are called from application code but **no `CREATE FUNCTION` appears** in `supabase/migrations/`:

| RPC | Used in |
|-----|---------|
| `generate_ticket_number` | `src/app/api/support/tickets/route.ts` |
| `mark_order_paid` | `src/app/admin/pos/page.tsx` |
| `get_support_dashboard_stats` | `src/app/admin/support/page.tsx` |
| `get_ai_memories` | `src/app/api/chat/route.ts` |
| `upsert_customer_insight` | `src/app/api/chat/route.ts` |
| `upsert_chat_conversation` | `src/app/api/chat/route.ts` |

**Action required:** Export these from the live Supabase project and add forward migrations before any Postgres cutover.

### Migrations in repo

| Migration | Purpose |
|-----------|---------|
| `20250324180000_init_store.sql` | Core schema + RLS |
| `20250407120000_seed_default_categories.sql` | Category seeds |
| `20250408130000_cleanup_legacy_categories.sql` | Category cleanup |
| `20260413120000_categories_featured_and_parent.sql` | Category tree |
| `20260413140000_ensure_storage_product_images_bucket.sql` | Storage bucket |
| `20260413150000_products_admin_columns.sql` | Admin product fields |
| `20260414120000_catalog_skin_lip_and_more_categories.sql` | Catalog expansion |
| `20260415120000_profiles_permissions_jsonb.sql` | Staff permissions |
| `20260416120000_remove_six_categories_reassign_products.sql` | Category reassign |
| `20260429120000_lock_profiles_role_self_update.sql` | Profile security |
| `20260704183000_add_out_for_delivery_status.sql` | Order status enum |
| `20260803120000_rebrand_trust_ecom_defaults.sql` | Trust Ecom brand defaults |
| `20260803140000_payment_integrity.sql` | Payment indexes, callback_events, sms_attempts |

---

## 9. Infrastructure (VPS)

- Big VPS **does not** have `store_trustecom` provisioned yet (per fleet inventory at audit time).
- Mamator reference pattern: `store_*` database, `DATABASE_URL`, uploads under `/var/www/<store>/uploads`.
- Trust Ecom production domain placeholder: `trustecom.com` (`src/lib/brand.ts`).

---

## 10. Brand / Content

- Central config: `src/lib/brand.ts` — Trust Ecom name, tagline, `hello@trustecom.com`.
- Assets: `public/brand/logo.png`, PWA icons; legacy `ronnyandme-logo.png` removed.
- Storefront copy updated across pages (git diff); phone/social placeholders empty until launch.

---

## 11. Recommended Next Steps

1. Apply `20260803140000_payment_integrity.sql` to production Supabase if not already applied.
2. Export missing RPC definitions into migrations.
3. Set all payment env vars including `MOOLRE_CALLBACK_SECRET` and `PAYSTACK_WEBHOOK_SECRET`.
4. Run `node scripts/reconcile-payments.mjs` on a schedule (report-only first).
5. Add pagination to admin orders/products/customers before catalog growth.
6. Plan Postgres cutover using `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` — **do not claim complete until runtime has zero `@supabase/*` imports**.

---

*This document reflects repository and static analysis state as of 2026-08-03. It does not certify production deployment configuration.*
