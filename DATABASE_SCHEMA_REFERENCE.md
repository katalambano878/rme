# Database Schema Reference — RME (`rme_staging`)

PostgreSQL 16. Active schemas: `public`, `auth`.

## Core commerce

| Table | Purpose | PK | Notable columns / FKs |
|-------|---------|----|------------------------|
| `categories` | Catalog categories | `id` | `slug` unique, `parent_id`→categories |
| `products` | Catalog products | `id` | `slug` unique, `price`, `sale_price`, `compare_at_price`, `category_id`→categories |
| `product_images` | Product gallery | `id` | `product_id`→products CASCADE, `url`, `sort_order` |
| `variants` | SKU / stock / options | `id` | `sku` unique, `sale_price`, `product_id`→products CASCADE |
| `orders` | Checkout orders | `id` | `order_number` **unique**, `status` enum, `grand_total`, guest contact JSON addresses |
| `order_items` | Line items | `id` | FKs to orders/products/variants; `options_snapshot` jsonb |
| `payments` | Gateway attempts | `id` | FK→orders; unique `(provider, provider_ref)`; one `paid` per order |
| `inventory_movements` | Stock ledger | `id` | `variant_id` required; unique (order, variant) when `reference_type=order` |
| `discounts` | Coupons | `id` | `code` unique |
| `shipments` / `returns` | Fulfillment | `id` | FK→orders |
| `webhook_logs` | Callback audit | `id` | `provider`, `event_type`, `payload` |

## Auth / admin

| Table | Purpose |
|-------|---------|
| `auth.users` | Credentials + metadata (bcrypt) |
| `profiles` | App role (`user_role` enum), permissions jsonb |
| `store_admins` / `superadmins` | Email allowlists |

## Content / support

`blog_posts` (`body` not `content`), `home_content`, `site_settings`, `storefront_settings`, `testimonials`, `occasions`, `chat_conversations`, `support_*`, `ai_memory`, `customer_insights`.

## Enums

- `order_status`: pending, paid, processing, shipped, out_for_delivery, delivered, cancelled, refunded  
- `payment_status`: pending, authorized, paid, failed, refunded  
- `user_role`: customer, staff, admin, superadmin  

## Guards

- Triggers: `orders_prevent_paid_downgrade`, `payments_prevent_paid_downgrade`  
- Checks: non-negative payment amount / order grand_total  
