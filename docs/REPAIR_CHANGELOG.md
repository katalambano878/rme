# Repair Changelog — Trust Ecom cutover

**Date:** 2026-08-03

## Packages

- **Added:** `jose`, `bcryptjs`, `@types/bcryptjs`
- **Removed:** `@supabase/ssr`, `@supabase/supabase-js`

## Auth / middleware

- `src/lib/auth/*` — password, token, session, index
- `src/lib/auth.ts` — re-exports
- `src/middleware.ts` — JWT admin gate; payment callbacks public
- `/api/auth/login|signup|logout|me`
- Login pages (storefront + admin) + admin layout use `/api/auth/*`
- DB: `db/migrations/001_auth_users_session_cols.sql` (`last_sign_in_at`)

## Data / payments

- Storefront: `src/lib/data/storefront-products.ts` (+ content helpers)
- Payments: Paystack + Moolre routes on `pg`
- `fulfill-paid-order.ts`, `order-stock.ts`, notifications DB reads on `pg`
- Admin catalog/orders/stats/customers/coupons/reviews/blog APIs
- Uploads: `/api/uploads` + next rewrite
- Support APIs: graceful empty/501 without tables

## Cleanup

- Deleted `src/lib/supabase*` runtime clients
- `.env.example` / `src/lib/env.ts` — Postgres + `AUTH_SECRET` (no Supabase keys)
- `scripts/create-admin-user.mjs` — bcrypt + `auth.users`

## Manual actions

1. Set Coolify `AUTH_SECRET`, `UPLOAD_DIR`, upload base URL (script: `scripts/set-trustecom-auth-env.sh`)
2. Push `staging/trustecom` and redeploy `trustecom-staging`
3. Seed admin: `DATABASE_URL=… npm run create-admin -- email password`
4. Configure Paystack/Moolre secrets on Coolify if not already set
5. Optional: create support tables if chat/tickets required
