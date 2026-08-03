# Trust Ecom — Full System Audit

**Audit date:** 2026-08-03 (cutover pass)  
**Brand:** Trust Ecom  
**Stack:** Next.js 16 (App Router), React 19, Tailwind 4, plain PostgreSQL (`pg` + `DATABASE_URL`)

---

## Baseline (before this repair pass)

| Check | Status |
|-------|--------|
| Runtime data access | Still Supabase JS / PostgREST / Auth / Storage |
| Plain Postgres foundation | `src/lib/db.ts`, `/api/health`, `store_trustecom` schema applied |
| Staging app | `trustecom-staging` on Coolify; `rme-staging` untouched |
| Hubtel | Not present in codebase |
| Build | Succeeded while Supabase env present |
| Auth | Supabase Auth cookies; broken without Supabase keys |

### Root cause of post-migration breakage

Staging Coolify env had `DATABASE_URL` only (no Supabase keys), while **nearly every page and API still called Supabase**. That produced broken pages, failed APIs, auth failures, and missing data — not isolated UI bugs.

---

## Architecture (after cutover)

```
Browser
  ├─ cookie: trustecom_session (JWT / AUTH_SECRET)
  └─ fetch /api/* with credentials: 'include'
        │
        ▼
Next.js API / Server Components
  ├─ src/lib/auth (bcrypt + jose)
  ├─ src/lib/db (pg Pool on DATABASE_URL)
  └─ src/lib/data/* repositories
        │
        ▼
PostgreSQL store_trustecom (fleet-pgbouncer)
  auth.users + public.profiles + catalog/orders/payments
        │
        ├── Paystack / Moolre (server-side verify + callbacks)
        ├── Moolre SMS + Resend email
        └── Local uploads → UPLOAD_DIR → /api/uploads
```

---

## Route inventory (summary)

### Storefront pages
`/`, `/shop`, `/collections`, `/products/[slug]`, `/cart`, `/checkout*`, `/track-order`, `/account`, `/auth/login`, `/auth/signup`, `/about`, `/contact`, `/blog`, `/blog/[slug]`, policies.

### Admin pages
`/admin/login` + dashboard, products, categories, orders, customers, coupons, reviews, blog, inventory, sales, analytics, POS, staff, notifications, modules, support, test-sms, customer-insights.

### Critical APIs
| Route | Auth | Notes |
|-------|------|-------|
| `/api/health` | public | DB + env report |
| `/api/auth/*` | public login/signup; me/logout session | JWT cookie |
| `/api/paystack/*` | public init/verify/webhook | server amount calc |
| `/api/payment/moolre/*` | public + callback secret | |
| `/api/orders/track` | public | guest track |
| `/api/catalog/*` | admin | products/categories |
| `/api/admin/*` | admin | orders/stats/customers/… |
| `/api/uploads` | admin POST / public GET | disk storage |
| `/api/support/*` | mixed | 501/empty if tables missing |

---

## Page audit status

| Area | Status |
|------|--------|
| Storefront catalog (server) | Fixed — `src/lib/data/storefront-products.ts` |
| Auth login/signup/admin | Fixed — `/api/auth/*` |
| Payments Paystack/Moolre | Fixed — `pg` + `fulfillPaidOrder` |
| Admin CRUD pages | Fixed — REST + `api()` |
| Support/chat | Partial — graceful empty/501 without support tables |
| Hubtel | N/A — not implemented |
| Live E2E on staging | Requires deploy + `AUTH_SECRET` + admin seed |

---

## Security notes

- RLS removed with Supabase; authorization is application-layer (`verifyAuth` / middleware / ownership checks).
- Payment amounts recomputed server-side from DB.
- Moolre callback requires `MOOLRE_CALLBACK_SECRET`.
- Secrets must not use `NEXT_PUBLIC_` prefix.
- Uploads: admin-only write; path traversal blocked on read.

---

## Remaining risks

1. Support/AI tables may be absent on `store_trustecom`.
2. Staging needs redeploy with cutover commit + `AUTH_SECRET`.
3. Admin user must be seeded via `npm run create-admin` against `DATABASE_URL`.
4. Legacy product image URLs may still point at old Supabase storage hosts until re-uploaded.
5. Hubtel is not in the product; do not claim gateway parity for Hubtel.
