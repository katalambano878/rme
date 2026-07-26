# RME — Supabase → plain Postgres cutover

**Shape:** A — shimmed `@supabase/supabase-js` → plain PG  
**Coolify staging:** `rme-staging` (`x1m0wkekcedagfdbwhn5zq76`)  
**Staging URL:** https://rme-staging.169-58-8-203.sslip.io  
**DB:** `fleet-postgres` / `store_rme` (confirm name in Coolify env)

## Env cutover trio

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `postgresql://…@fleet-postgres:5432/<db>` |
| `NEXT_PUBLIC_USE_PLAIN_PG` | `true` |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging/production app origin |

## Hardening notes (Jul 2026)

- [x] Phase A: `public/service-worker.js` (`sw-v2.5-rme`), `lib/format-money.ts`, error boundaries
- [x] Phase B: `images.unoptimized`; CSP `img-src` / `connect-src` no longer allow Supabase or via.placeholder
- [x] `src/components/*` money via `money()` from `@/lib/format-money`
- [x] Chat writer + admin staff service paths → `@/lib/supabase-admin` (support/payment/notifications already on admin client)
- [ ] Account order tab still uses mock data (no coming-soon alerts to replace)

## Verify

```bash
BASE=https://rme-staging.169-58-8-203.sslip.io
ssh big-vps "sudo docker ps --format '{{.Image}} {{.Status}}' | grep x1m0wke"
curl -s "$BASE/service-worker.js" | head -n 3
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/" "$BASE/shop"
```
