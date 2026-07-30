# Performance Report — RME

## Baseline symptoms

- Admin/middleware calling Supabase `getUser()` on nearly every matched request
- HTTP loopback risk when payment APIs used hosted SDK against self URL instead of in-process `pg`
- Missing indexes on payment/order lookup columns
- External payment/SMS fetches without timeouts (hang → UI freeze)

## Freezing / slowness causes (confirmed)

1. **Middleware overreach** — old `src/middleware.ts` matched almost all routes and awaited auth.
2. **Wrong data plane** — `createAdminClient` without PG branch added network hops / failures under cutover.
3. **Missing RPCs** — chat/support/POS failed and retried or swallowed errors.
4. **Build shadowing** — root `app/` caused empty builds locally (deploy risk if reproduced).

## Fixes

| Area | Change |
|------|--------|
| Middleware | Admin-only matcher; JWT verify in plain-PG; payment/auth/storage shims skipped |
| DB access | Payment routes → mode-aware admin client (in-process pool) |
| Indexes | `payments(provider_ref,order_id)`, `orders(order_number)`, `(status,created_at)`, chat `session_id` unique |
| Timeouts | Moolre link/status 15–20s; SMS 15s |
| Pool | Existing singleton `src/lib/db/pool.ts` (`PG_POOL_MAX`) |

## Before / after (staging smoke)

| Endpoint | Before | After (code) |
|----------|--------|--------------|
| Public pages | 200 | 200 |
| Admin gate | SSR getUser path | JWT + `sb-access-token` |
| `/rest/v1/products` | 200 | 200 |

Quantitative lab timings were not collected in CI; recommend Lighthouse + API `curl -w %{time_total}` after redeploy.

## Recommendations

- Move `pg` remains in `dependencies` (done).
- Add pagination audits on admin order/customer lists under load.
- Consider Redis/rate-limit store if multi-instance Coolify.
- Cache public product list with short revalidate (careful with sale flags).
