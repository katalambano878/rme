# Performance Report — Trust Ecom

**Date:** 2026-08-03

## Freezing / slowness — root causes found

1. **Missing backend (primary):** Staging had Postgres env but pages still called Supabase → hung/failed fetches, blank admin, frozen buttons waiting on auth.
2. **Client-side PostgREST from admin:** Large unpaginated `.select('*')` from browser; replaced with server APIs (still need pagination hardening on huge catalogs).
3. **Middleware previously refreshed Supabase sessions on every matched route** — replaced with lightweight JWT verify for `/admin` and `/api` only.

## Fixes applied

- Shared `pg` pool (`DATABASE_POOL_MAX`, statement timeout)
- Storefront product queries use single SQL with `jsonb_agg` (avoids N+1 PostgREST embeds)
- Payment callbacks acknowledge after DB update; notifications best-effort
- Cart/home pages tolerate DB miss during build (`force-dynamic` / try-catch where needed)

## Before / after (qualitative)

| Symptom | Before | After |
|---------|--------|-------|
| Admin login on staging | Fail (no Supabase) | JWT + auth.users |
| Storefront products | Fail without Supabase | `DATABASE_URL` SQL |
| Payment verify | Service-role Supabase | `pg` + fulfill helper |
| Middleware cost | Supabase SSR cookie refresh | JWT verify only |

## Follow-ups

- Add pagination defaults on admin product/order lists
- Index review: `orders(order_number)`, `payments(provider_ref)`, `products(status, created_at)` (many already in migrations)
- Measure TTFB on staging after deploy with `curl -w` /browser profiler
