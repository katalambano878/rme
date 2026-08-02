# Database Performance Report — RME

## Pool

- Shared singleton `pg.Pool` (`src/lib/db/pool.ts`)  
- Default `PG_POOL_MAX=10`  
- Idle timeout 30s  
- Numeric parsed as float (storefront-friendly; money compared with tolerance in payment routes)

## Indexes added (2026-08-02)

- `orders_order_number_uidx` (unique)  
- `payments_provider_ref_uidx`, `payments_one_paid_per_order_uidx`  
- `order_items_order_id_idx`, `order_items_product_id_idx`  
- `orders_guest_email_idx`  
- `inventory_movements_order_ref_idx`, `inventory_movements_order_variant_uidx`  

Existing useful indexes: `orders_status_created_idx`, `payments_order_id_idx`, `products_status_idx`, `variants_product_idx`.

## Known hotspots

| Area | Issue | Mitigation |
|------|-------|------------|
| Shop images | Large originals | `/api/img` WebP proxy + disk cache |
| Nested REST embeds | N+1 style batched embeds | Compat batches by FK IN lists |
| Admin order detail | Nested products→images | Fixed parent-table embed bug |
| Dashboard aggregates | Unpaginated counts possible | Prefer indexed status filters |

## Freezing / connections

- No per-request Pool construction  
- REST no longer allows anonymous write storms as easily  
- Health: `GET /api/health/db`  

## Measurements (server-side, staging)

- Homepage ~0.1–0.3s  
- Shop ~0.5–0.7s  
- Image proxy mock WebP ~2KB after cache  
