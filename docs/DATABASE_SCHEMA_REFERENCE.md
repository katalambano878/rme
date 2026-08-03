# Database Schema Reference — Trust Ecom (`store_trustecom`)

**Database:** `store_trustecom`  
**Schema version:** Plain Postgres install as of 2026-08-03  
**Source migrations:** `supabase/migrations/` + `db/migrations/000_auth_stub.sql`  
**Public tables:** 32  
**RLS:** Not enabled on VPS install (app-layer authz required)

---

## Enums

| Enum | Values |
|------|--------|
| `public.user_role` | `customer`, `staff`, `admin`, `superadmin` |
| `public.order_status` | `pending`, `paid`, `processing`, `shipped`, `out_for_delivery`, `delivered`, `cancelled`, `refunded` |
| `public.payment_status` | `pending`, `authorized`, `paid`, `failed`, `refunded` |

---

## Auth schema (stub)

### `auth.users`

Plain Postgres stub for FK compatibility with `profiles`. **Not** Supabase GoTrue.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` default |
| `email` | text | Unique (case-insensitive index) |
| `encrypted_password` | text | App-managed when auth is implemented |
| `email_confirmed_at` | timestamptz | |
| `raw_user_meta_data` | jsonb | Default `{}` |
| `created_at`, `updated_at` | timestamptz | |

**Function:** `auth.uid()` → always `NULL` (no-op for leftover SQL).

**Trigger:** `on_auth_user_created` → `public.handle_new_user()` creates/updates `profiles` and applies allowlist roles.

---

## Public tables (32)

### 1. `profiles`

User profile and RBAC role. 1:1 with `auth.users`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `email` | text | Indexed |
| `full_name`, `phone`, `avatar_url` | text | |
| `role` | `user_role` | Default `customer` |
| `permissions` | jsonb | Default `{}` — optional staff flags (migration `20260415120000`) |
| `created_at`, `updated_at` | timestamptz | |

**Indexes:** `profiles_email_idx`

---

### 2. `superadmins`

Platform superadmin email allowlist.

| Column | Type |
|--------|------|
| `email` | text PK |
| `created_at` | timestamptz |

---

### 3. `store_admins`

Store admin email allowlist.

| Column | Type |
|--------|------|
| `email` | text PK |
| `created_at` | timestamptz |

---

### 4. `storefront_settings`

Singleton (id=1) public-safe store configuration.

| Column | Type | Default / notes |
|--------|------|-----------------|
| `id` | smallint PK | Must be `1` |
| `store_name` | text | `'Trust Ecom'` |
| `announcement_bar` | text | |
| `maintenance_mode` | boolean | `false` |
| `whatsapp_number`, `support_email` | text | Seed: `hello@trustecom.com` |
| `currency_code` | text | `'GHS'` |
| `created_at`, `updated_at` | timestamptz | |

---

### 5. `site_settings`

Singleton (id=1) admin-only settings (payment keys stored in env, not here).

| Column | Type | Default |
|--------|------|---------|
| `id` | smallint PK | `1` |
| `feature_flags` | jsonb | `{}` |
| `payment_providers` | jsonb | Moolre enabled, Paystack disabled in seed |
| `analytics`, `theme` | jsonb | `{}` |
| `created_at`, `updated_at` | timestamptz | |

---

### 6. `categories`

Product taxonomy.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name`, `slug` | text | `slug` UNIQUE |
| `description`, `image_url` | text | |
| `sort_order` | int | Default 0 |
| `is_active` | boolean | Default true |
| `featured_on_home` | boolean | Default false (migration) |
| `parent_id` | uuid | FK → `categories(id)` ON DELETE SET NULL |
| `created_at` | timestamptz | |

**Seed slugs:** `featured`, `new-arrivals`, `best-sellers`, `sale`

---

### 7. `collections`

Manual or smart product groupings.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name`, `slug` | text | `slug` UNIQUE |
| `description`, `image_url` | text | |
| `collection_type` | text | `manual` \| `smart` |
| `rules` | jsonb | Smart collection rules |
| `sort_order`, `is_active` | | |
| `created_at` | timestamptz | |

---

### 8. `products`

Catalog products.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `category_id` | uuid | FK → `categories(id)` ON DELETE SET NULL |
| `name`, `slug` | text | `slug` UNIQUE |
| `description`, `short_description` | text | |
| `status` | text | `draft` \| `active` \| `archived` |
| `is_featured`, `is_new_arrival`, `is_best_seller` | boolean | |
| `badges` | text[] | |
| `rating_avg` | numeric(3,2) | |
| `review_count` | int | |
| `delivery_estimate`, `seo_title`, `seo_description` | text | |
| `price`, `compare_at_price` | numeric(12,2) | Admin columns (migration) |
| `sku` | text | |
| `quantity`, `moq` | int | Defaults 0, 1 |
| `tags` | text[] | Default `{}` |
| `metadata` | jsonb | Default `{}` |
| `created_at`, `updated_at` | timestamptz | |

**Indexes:** `products_category_idx`, `products_status_idx`

---

### 9. `product_images`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `product_id` | uuid | FK → `products(id)` ON DELETE CASCADE |
| `storage_path`, `url`, `alt` | text | |
| `sort_order` | int | |
| `created_at` | timestamptz | |

**Index:** `product_images_product_idx`

---

### 10. `attributes`

Variant attribute definitions (e.g. Size, Color).

| Column | Type |
|--------|------|
| `id` | uuid PK |
| `name`, `slug` | text, UNIQUE slug |
| `display_type` | `select` \| `color` |
| `sort_order` | int |

---

### 11. `attribute_values`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `attribute_id` | uuid | FK → `attributes(id)` CASCADE |
| `value` | text | UNIQUE per attribute |
| `sort_order` | int | |

---

### 12. `variants`

Sellable SKU rows.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `product_id` | uuid | FK → `products(id)` CASCADE |
| `sku` | text | UNIQUE |
| `price`, `compare_at_price` | numeric(12,2) | |
| `stock_quantity` | int | |
| `option_values` | jsonb | Default `[]` |
| `created_at`, `updated_at` | timestamptz | |

**Index:** `variants_product_idx`

---

### 13. `inventory_movements`

Stock audit trail.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `variant_id` | uuid | FK → `variants(id)` CASCADE |
| `quantity_delta` | int | |
| `reason` | text | |
| `reference_type`, `reference_id` | text, uuid | |
| `created_by` | uuid | FK → `profiles(id)` |
| `created_at` | timestamptz | |

**Index:** `inventory_movements_variant_idx`

---

### 14. `collection_products`

Many-to-many collections ↔ products.

| Column | Type | Notes |
|--------|------|-------|
| `collection_id` | uuid | FK → `collections(id)` CASCADE |
| `product_id` | uuid | FK → `products(id)` CASCADE |
| `sort_order` | int | |
| **PK** | | `(collection_id, product_id)` |

---

### 15. `addresses`

Customer shipping addresses.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid | FK → `profiles(id)` CASCADE |
| `label`, `full_name`, `phone` | text | |
| `line1`, `line2`, `city`, `region` | text | |
| `country` | text | Default `Ghana` |
| `postal_code` | text | |
| `is_default` | boolean | |
| `created_at` | timestamptz | |

**Index:** `addresses_user_idx`

---

### 16. `wishlists`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid | FK → `profiles(id)` CASCADE |
| `product_id` | uuid | FK → `products(id)` CASCADE |
| `variant_id` | uuid | FK → `variants(id)` SET NULL |
| `created_at` | timestamptz | |

**Partial unique indexes:** one row per user+product (with/without variant)

---

### 17. `carts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid | FK → `profiles(id)` CASCADE, nullable |
| `session_id` | text | Guest carts |
| `updated_at` | timestamptz | |
| **Check** | | Exactly one of `user_id` or `session_id` set |

**Indexes:** `carts_user_idx`, `carts_session_idx`

---

### 18. `cart_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `cart_id` | uuid | FK → `carts(id)` CASCADE |
| `variant_id` | uuid | FK → `variants(id)` CASCADE |
| `quantity` | int | > 0, UNIQUE `(cart_id, variant_id)` |

---

### 19. `discounts`

Coupon / promotion codes.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `code` | text | UNIQUE |
| `description` | text | |
| `discount_type` | text | `percent` \| `fixed` \| `free_shipping` |
| `value`, `min_spend` | numeric | |
| `max_uses`, `uses_count` | int | |
| `starts_at`, `ends_at` | timestamptz | |
| `is_active` | boolean | |
| `created_at` | timestamptz | |

---

### 20. `orders`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `order_number` | text | UNIQUE |
| `user_id` | uuid | FK → `profiles(id)` SET NULL |
| `guest_email`, `guest_phone` | text | |
| `status` | `order_status` | Default `pending` |
| `subtotal`, `discount_total`, `shipping_total`, `tax_total`, `grand_total` | numeric(12,2) | |
| `currency` | text | Default `GHS` |
| `shipping_address`, `billing_address` | jsonb | |
| `notes` | text | |
| `discount_id` | uuid | FK → `discounts(id)` |
| `created_at`, `updated_at` | timestamptz | |

**Indexes:** `orders_user_idx`, `orders_number_idx`, `orders_order_number_idx`

---

### 21. `order_items`

Line items (snapshots at purchase time).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `order_id` | uuid | FK → `orders(id)` CASCADE |
| `product_id` | uuid | FK → `products(id)` |
| `variant_id` | uuid | FK → `variants(id)` |
| `name_snapshot`, `sku_snapshot` | text | |
| `unit_price`, `line_total` | numeric(12,2) | |
| `quantity` | int | > 0 |

**Index:** `order_items_order_idx`

---

### 22. `payments`

Gateway payment attempts and outcomes.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `order_id` | uuid | FK → `orders(id)` CASCADE |
| `provider` | text | e.g. `paystack`, `moolre` |
| `provider_ref` | text | Gateway reference |
| `amount`, `currency` | numeric, text | |
| `status` | `payment_status` | Default `pending` |
| `raw_payload` | jsonb | |
| `created_at`, `updated_at` | timestamptz | |

**Indexes:**

- `payments_order_idx`
- `payments_provider_ref_unique` — UNIQUE on `provider_ref` WHERE NOT NULL and non-empty
- `payments_order_provider_paid_unique` — UNIQUE `(order_id, provider)` WHERE `status = 'paid'`
- `payments_status_created_idx` — `(status, created_at DESC)`

---

### 23. `shipments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `order_id` | uuid | FK → `orders(id)` CASCADE |
| `carrier`, `tracking_number` | text | |
| `status` | text | Default `pending` |
| `shipped_at`, `delivered_at` | timestamptz | |
| `created_at` | timestamptz | |

---

### 24. `returns`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `order_id` | uuid | FK → `orders(id)` CASCADE |
| `user_id` | uuid | FK → `profiles(id)` |
| `reason`, `status` | text | |
| `created_at` | timestamptz | |

---

### 25. `reviews`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `product_id` | uuid | FK → `products(id)` CASCADE |
| `user_id` | uuid | FK → `profiles(id)` SET NULL |
| `rating` | int | 1–5 |
| `title`, `body` | text | |
| `is_verified_purchase`, `is_published` | boolean | |
| `created_at` | timestamptz | |

**Index:** `reviews_product_idx`

---

### 26. `blog_posts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `title`, `slug` | text | `slug` UNIQUE |
| `excerpt`, `body` | text | |
| `cover_image_url`, `category` | text | |
| `published` | boolean | |
| `published_at` | timestamptz | |
| `read_time_minutes` | int | |
| `created_at`, `updated_at` | timestamptz | |

---

### 27. `home_content`

Singleton homepage section JSON.

| Column | Type |
|--------|------|
| `id` | smallint PK (=1) |
| `sections` | jsonb |
| `updated_at` | timestamptz |

---

### 28. `webhook_logs`

Legacy/generic webhook debug log (Paystack/Moolre also use `callback_events` when available).

| Column | Type |
|--------|------|
| `id` | uuid PK |
| `provider`, `event_type` | text |
| `payload`, `headers` | jsonb |
| `status_code` | int |
| `error` | text |
| `created_at` | timestamptz |

**Indexes:** `webhook_logs_provider_idx`, `webhook_logs_created_idx`

---

### 29. `login_audit_log`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid | FK → `profiles(id)` SET NULL |
| `email` | text | |
| `ip` | inet | |
| `user_agent` | text | |
| `success` | boolean | |
| `created_at` | timestamptz | |

---

### 30. `callback_events`

Payment gateway callback audit (migration `20260803140000`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `gateway` | text | `paystack`, `moolre`, … |
| `event_type` | text | |
| `external_event_id` | text | Idempotency key with gateway |
| `reference` | text | Order/payment reference |
| `payload_hash` | text | |
| `signature_status` | text | Default `unknown` |
| `processing_status` | text | Default `received` |
| `attempts` | int | |
| `error_message` | text | |
| `raw_payload` | jsonb | |
| `received_at`, `processed_at` | timestamptz | |

**Indexes:**

- `callback_events_gateway_external_unique` — UNIQUE `(gateway, external_event_id)` WHERE NOT NULL
- `callback_events_reference_idx`

---

### 31. `sms_attempts`

Outbound SMS audit (Moolre SMS).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `provider` | text | Default `moolre` |
| `recipient` | text | |
| `message_type`, `template_name` | text | |
| `related_user_id` | uuid | |
| `related_order_id` | uuid | FK → `orders(id)` SET NULL |
| `related_payment_id` | uuid | FK → `payments(id)` SET NULL |
| `provider_message_id` | text | |
| `status` | text | Default `pending` |
| `attempts` | int | |
| `failure_reason` | text | |
| `sent_at`, `delivered_at`, `created_at` | timestamptz | |

**Index:** `sms_attempts_order_type_idx`

---

### 32. `schema_migrations`

Plain-Postgres migration bookkeeping (not Supabase CLI history).

| Column | Type |
|--------|------|
| `id` | text PK |
| `applied_at` | timestamptz |

---

## Entity relationship overview

```
auth.users ──1:1── profiles ──┬── addresses, wishlists, carts, orders, reviews
                               └── inventory_movements.created_by

categories ──1:N── products ──1:N── variants ──1:N── inventory_movements
                    │                    │
                    ├── product_images   └── cart_items
                    └── reviews

collections ──N:M── products (collection_products)

orders ──1:N── order_items, payments, shipments, returns
         └── referenced by sms_attempts

discounts ──optional── orders
```

---

## Objects intentionally omitted on plain Postgres

The following exist in full Supabase `init_store.sql` but are **skipped** by `apply-store-trustecom-schema.sh`:

- Row Level Security policies on all `public` tables
- `profile_role()`, `is_staff()`, `is_admin_or_above()`, `is_superadmin()` (real implementations; replaced with always-false stubs)
- `storage.buckets` and `storage.objects` policies
- Supabase Realtime publications

---

## Tables used by app but not in this schema

Support/chat API routes under `src/app/api/support/` expect additional tables that are **not** defined in repo migrations (likely live only on Supabase today). Plan separate migrations before those features work on `store_trustecom`.

---

## Health check required tables

`src/lib/db-health.ts` validates presence of:

`profiles`, `storefront_settings`, `site_settings`, `categories`, `products`, `product_images`, `variants`, `orders`, `order_items`, `payments`, `callback_events`, `sms_attempts`, `webhook_logs`, `schema_migrations`

All are included in the 32-table inventory above.
