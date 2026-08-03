# Database Performance Report — Trust Ecom

**Report date:** 2026-08-03  
**Database:** `store_trustecom` (PostgreSQL 16.14)  
**Status:** Index inventory documented; **no EXPLAIN baselines** captured yet.

---

## Executive summary

| Area | Status |
|------|--------|
| Core catalog indexes | From `init_store.sql` — applied |
| Payment integrity indexes | From `20260803140000_payment_integrity.sql` — applied |
| Connection pooling (app) | `src/lib/db.ts` — configurable `pg` Pool |
| Connection pooling (VPS) | `fleet-pgbouncer` in front of `fleet-postgres` |
| Query profiling | **Not done** — no `EXPLAIN ANALYZE` baselines |
| Load testing | **Not done** |

Performance tuning should begin after application queries are retargeted to plain Postgres and representative traffic exists on staging.

---

## 1. Indexes (by domain)

### 1.1 Users and profiles

| Index | Table | Columns | Source |
|-------|-------|---------|--------|
| `profiles_email_idx` | `profiles` | `email` | `init_store` |
| `auth_users_email_lower_idx` | `auth.users` | `lower(email)` WHERE NOT NULL | `000_auth_stub` |

### 1.2 Catalog

| Index | Table | Columns | Source |
|-------|-------|---------|--------|
| `products_category_idx` | `products` | `category_id` | `init_store` |
| `products_status_idx` | `products` | `status` | `init_store` |
| `product_images_product_idx` | `product_images` | `product_id` | `init_store` |
| `variants_product_idx` | `variants` | `product_id` | `init_store` |
| `reviews_product_idx` | `reviews` | `product_id` | `init_store` |
| `inventory_movements_variant_idx` | `inventory_movements` | `variant_id` | `init_store` |

**Note:** `categories.slug`, `products.slug`, `variants.sku`, and PKs have implicit unique B-tree indexes.

### 1.3 Cart and wishlist

| Index | Table | Columns | Source |
|-------|-------|---------|--------|
| `carts_user_idx` | `carts` | `user_id` | `init_store` |
| `carts_session_idx` | `carts` | `session_id` | `init_store` |
| `addresses_user_idx` | `addresses` | `user_id` | `init_store` |
| `wishlists_user_product_no_variant` | `wishlists` | `(user_id, product_id)` WHERE `variant_id IS NULL` | `init_store` |
| `wishlists_user_product_variant` | `wishlists` | `(user_id, product_id, variant_id)` WHERE `variant_id IS NOT NULL` | `init_store` |

### 1.4 Orders and payments

| Index | Table | Columns | Source |
|-------|-------|---------|--------|
| `orders_user_idx` | `orders` | `user_id` | `init_store` |
| `orders_number_idx` | `orders` | `order_number` | `init_store` |
| `orders_order_number_idx` | `orders` | `order_number` | `payment_integrity` |
| `order_items_order_idx` | `order_items` | `order_id` | `init_store` |
| `payments_order_idx` | `payments` | `order_id` | `init_store` |
| `payments_provider_ref_unique` | `payments` | `provider_ref` (partial UNIQUE) | `payment_integrity` |
| `payments_order_provider_paid_unique` | `payments` | `(order_id, provider)` WHERE `status = 'paid'` | `payment_integrity` |
| `payments_status_created_idx` | `payments` | `(status, created_at DESC)` | `payment_integrity` |

### 1.5 Webhooks and callbacks

| Index | Table | Columns | Source |
|-------|-------|---------|--------|
| `webhook_logs_provider_idx` | `webhook_logs` | `provider` | `init_store` |
| `webhook_logs_created_idx` | `webhook_logs` | `created_at DESC` | `init_store` |
| `callback_events_gateway_external_unique` | `callback_events` | `(gateway, external_event_id)` (partial UNIQUE) | `payment_integrity` |
| `callback_events_reference_idx` | `callback_events` | `reference` | `payment_integrity` |
| `sms_attempts_order_type_idx` | `sms_attempts` | `(related_order_id, message_type)` | `payment_integrity` |

---

## 2. Application pool configuration (`src/lib/db.ts`)

The shared `pg` Pool is hot-reload safe via `globalThis.__trustEcomPgPool`.

| Setting | Env var | Default | Notes |
|---------|---------|---------|-------|
| Connection string | `DATABASE_URL` | — | Required when pool is used |
| Max connections | `DATABASE_POOL_MAX` | `20` | Per Next.js instance |
| Idle timeout | `DATABASE_IDLE_TIMEOUT_MS` | `30000` | ms |
| Connect timeout | `DATABASE_CONNECT_TIMEOUT_MS` | `10000` | ms |
| Statement timeout | `DATABASE_STATEMENT_TIMEOUT_MS` | `30000` | ms — server-side per session |
| SSL | `DATABASE_SSL` / URL `sslmode=require` | off on internal VPS | Set `DATABASE_SSL=true` if needed |
| SSL reject unauthorized | `DATABASE_SSL_REJECT_UNAUTHORIZED` | `true` unless `false` | |

**Transaction helper:** `withTransaction()` — use for order + payment + stock updates during cutover.

**Current usage:** Only health check queries the pool today. Pool sizing has not been validated under real storefront load.

---

## 3. VPS infrastructure pooling

| Layer | Component | Role |
|-------|-----------|------|
| Database server | `fleet-postgres` | PostgreSQL 16.14, database `store_trustecom` |
| Pooler | `fleet-pgbouncer` | Transaction or session pooling for app connections |
| App | Coolify `trustecom-staging` | `DATABASE_URL` typically points at pgbouncer |

**Direct connections:** `DIRECT_URL` for migrations and admin scripts (bypass pgbouncer when required for DDL).

---

## 4. Known hot paths (expected after cutover)

These queries are implied by current Supabase usage and should be profiled first:

| Path | Tables | Suggested check |
|------|--------|-----------------|
| Product listing | `products`, `categories`, `variants`, `product_images` | `EXPLAIN ANALYZE` with `status = 'active'` filter |
| Product search | `products` (+ full-text if added) | May need `GIN` index on `name`/`tags` |
| Order by number | `orders` | Covered by `orders_order_number_idx` |
| Payment fulfill | `payments`, `orders`, `variants` | Transaction + row locks — use `withTransaction` |
| Webhook dedupe | `callback_events` | Unique index on gateway + external id |
| Admin order list | `orders` | May need `(status, created_at DESC)` if slow |

---

## 5. EXPLAIN baselines — not yet captured

**No `EXPLAIN (ANALYZE, BUFFERS)` baselines exist** for this project on `store_trustecom`.

Recommended first baseline set (run on staging after data seed/import):

```sql
-- Catalog list (adjust limits)
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id, p.name, p.slug, p.status
FROM public.products p
WHERE p.status = 'active'
ORDER BY p.created_at DESC
LIMIT 24;

-- Order lookup by number (Paystack path)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.orders WHERE order_number = 'ORD-EXAMPLE';

-- Payment integrity check
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.payments
WHERE provider_ref = 'example-ref' AND provider_ref IS NOT NULL;
```

Store results in a future `docs/explain-baselines/` folder or attach to release notes when cutover testing begins.

---

## 6. Future optimization candidates

| Candidate | When to consider |
|-----------|------------------|
| Composite index on `products(status, created_at DESC)` | Slow shop page after cutover |
| Full-text search index | If `/api/products/search` moves to SQL `tsvector` |
| Partial index on `orders(status)` for admin dashboards | High order volume |
| `VACUUM ANALYZE` schedule | After bulk import |
| Connection pool tuning | When multiple Next.js replicas share pgbouncer |
| Read replica | Not needed at current scale |

---

## 7. Monitoring hooks

| Endpoint / script | Performance relevance |
|-------------------|----------------------|
| `/api/health` | DB connectivity, table count — not query latency |
| `scripts/db-integrity-dry-run.sh` | Integrity, not performance |
| PostgreSQL `pg_stat_statements` | Enable on fleet if fleet admin allows — not verified |

---

## 8. Related documents

- [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) — full index list per table
- [DATABASE_AUDIT_AND_REPAIR_REPORT.md](./DATABASE_AUDIT_AND_REPAIR_REPORT.md) — architecture
- [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) — broader app performance (if present)
