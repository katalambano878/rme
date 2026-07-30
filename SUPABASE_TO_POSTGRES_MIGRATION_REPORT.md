# Supabase → Postgres Migration Report — RME

**Approach:** Shape A — keep supabase-js-shaped APIs; route server data plane to `pg` via `supabase-compat`.

## Feature matrix

| Supabase feature | Replacement | Status |
|------------------|-------------|---------|
| PostgREST queries | `src/lib/db/supabase-compat.ts` + `/rest/v1` | Working (staging) |
| Auth (email/password) | `src/lib/db/auth.ts` + `/auth/v1` | Working |
| Auth admin API | `auth.admin.createUser/deleteUser` on compat | Fixed |
| JWT sessions | `jose` + `AUTH_JWT_SECRET` | Working |
| Storage | Local disk + `/storage/v1` | Working when URL self-hosted |
| Realtime | Not used | N/A |
| RLS | App-layer authz (`requireAdmin`, ownership checks) | Partial — continue hardening |
| RPC `reduce_order_stock` | `src/lib/order-stock.ts` | Replaced earlier |
| RPC `mark_order_paid` | SQL in migration | Added |
| RPC `generate_ticket_number` | SQL (integer) | Added |
| RPC chat/support helpers | SQL | Added |
| Edge functions | Next.js API routes | Migrated |
| Browser SDK | Still `@supabase/ssr` against app origin | Documented dependency |

## Schema notes (`rme_staging`)

- DB name is **`rme_staging`** (not `store_rme`).
- `support_tickets.ticket_number` is **integer**; `email` is NOT NULL.
- Messages live in **`support_messages`** (`message` column), not `support_ticket_messages`.
- `customer_insights` table created if missing for chat RPC.

## Env cutover trio

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Enables in-process PG (`isPlainPostgres()`) |
| `NEXT_PUBLIC_USE_PLAIN_PG=true` | Edge/middleware plain-PG JWT path |
| `NEXT_PUBLIC_SUPABASE_URL` | Must be **app origin** so browser SDK hits shims |

## Remaining Supabase package usage

- `@supabase/supabase-js` / `@supabase/ssr` remain for browser client + hosted fallback.
- Runtime server paths with `DATABASE_URL` should use compat (`supabase-admin`, `createAdminClient`).

## Migration scripts

- SQL: `supabase/migrations/20260730090000_plain_pg_rpc_compat.sql` (applied on staging)
- Artifacts: `migration-artifacts/`
