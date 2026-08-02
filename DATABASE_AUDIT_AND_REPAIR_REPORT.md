# Database Audit and Repair Report — RonnyandMe (RME)

**Date:** 2026-08-02  
**Environment:** Coolify app `rme-staging` → Postgres database `rme_staging` on `fleet-postgres`  
**App URL:** https://ronnyandme.com  
**Branch:** `staging/plain-postgres`

## 1. Executive summary

After Supabase → plain PostgreSQL cutover, the app used a `pg` pool plus a PostgREST/GoTrue/Storage compatibility layer. Schema and payment integrity had drifted: missing `sale_price`, weak nested embeds, almost no foreign keys on commerce tables, duplicate payment rows, open `/rest/v1` writes (RLS gone), and payment callbacks that could downgrade paid orders or skip amount/stock checks.

This audit repaired schema constraints, payment guards, REST authorization, and documented remaining manual items. **Database is ready for staging testing after deploy of the application code changes.**

## 2. Architecture found

| Item | Value |
|------|-------|
| PostgreSQL | 16.14 |
| Host (logical) | `fleet-postgres` (Docker) |
| Database name | `rme_staging` |
| ORM | None — `pg` + custom `supabase-compat` |
| Clients | Singleton `getPool()`; dual-mode wrappers still import `@supabase/*` for hosted fallback |
| Migrations | SQL files in `supabase/migrations/` applied manually |
| Auth | `auth.users` + HS256 JWT (`sb-access-token`) |
| Storage | Local disk via `/storage/v1` |
| Payments | Moolre + Paystack (Hubtel not in codebase) |
| SMS | Moolre HTTP only — no SMS table |

## 3. Baseline (pre-repair)

- 38 public tables + `auth.users`
- Only **7** foreign keys (catalog only); orders/payments/order_items had **none**
- `orders.order_number` indexed but **not unique**
- 6 duplicate paid payment pairs (same `provider_ref`)
- 4 delivered orders with no payment rows (legacy/manual)
- 0 orphaned order_items / payments (safe to add FKs)
- Open REST shim: anonymous GET/POST/PATCH/DELETE on all tables

## 4. Repairs completed

### Schema / constraints (migration `20260802120000_integrity_fks_payment_guards.sql`)

- Deduped duplicate payment `provider_ref`s; unique `(provider, provider_ref)`
- Unique partial index: one `paid` payment per order
- Unique `orders.order_number`
- FKs: order_items→orders/products/variants, payments→orders, shipments/returns→orders, reviews/wishlists→products, cart_items→carts/variants
- Triggers: prevent paid order/payment status downgrades (refunds still allowed on payments)
- Check: non-negative `payments.amount`, `orders.grand_total`
- Indexes: order_items(order_id, product_id), orders(guest_email), inventory order refs + unique order+variant movements
- Deduped duplicate inventory movements

### Prior schema gaps (already applied earlier)

- `products.sale_price`, `variants.sale_price`, `order_items.options_snapshot`
- Nested embed parent-table fix in `supabase-compat`

### Application code

- Moolre failure callback no longer unpays fulfilled orders
- Paystack verify/webhook: amount check, idempotency, stock reduction
- Stock movements for product-only lines (via first variant when present)
- `/rest/v1` writes require staff/service JWT; sensitive reads require staff; public catalog remains readable

### Backup

- Pre-migration dump: `/data/fleet/backups/rme/rme_staging_commerce_20260802_125729.sql`

## 5. Remaining issues (manual / follow-up)

| Item | Severity | Notes |
|------|----------|-------|
| 4 delivered orders with no payments | Low | Historical; do not invent payment rows |
| RLS policies exist but are bypassed (app uses table owner) | Medium | App-layer auth is the control plane; REST now gated |
| `@supabase/*` packages remain for browser client + fallbacks | Low | Intentional Shape A pattern |
| No SMS persistence / Hubtel | Info | Not implemented |
| Automated test suite for payments | Medium | Recommended next |
| `create-admin-user.mjs` still targets hosted Supabase Auth | Medium | Use `/auth/v1` or SQL for plain-PG admins |

## 6. Post-repair checks

- FK count: **17** (was 7)
- Duplicate paid payments per order: **0**
- Paid-downgrade triggers: **2**
- Unique order_number / provider_ref / inventory movement indexes: present
