# Migration Status Report — RME

## Tooling

Manual SQL via `psql` / Coolify DB. No Prisma migrate. Files live in `supabase/migrations/`.

## Applied on `rme_staging` (verified 2026-08-02)

| File | Notes |
|------|-------|
| `20250324180000_init_store.sql` | Base schema |
| `20250407120000_seed_default_categories.sql` | Categories |
| `20250408130000_cleanup_legacy_categories.sql` | Cleanup |
| `20260413120000_categories_featured_and_parent.sql` | Featured/parent |
| `20260413140000_ensure_storage_product_images_bucket.sql` | Storage bucket (Supabase-era) |
| `20260413150000_products_admin_columns.sql` | Admin product columns |
| `20260414120000_catalog_skin_lip_and_more_categories.sql` | Category data |
| `20260415120000_profiles_permissions_jsonb.sql` | Permissions |
| `20260416120000_remove_six_categories_reassign_products.sql` | Category remap |
| `20260429120000_lock_profiles_role_self_update.sql` | Role escalation guard |
| `20260704183000_add_out_for_delivery_status.sql` | Enum value |
| `20260730090000_plain_pg_rpc_compat.sql` | RPCs + indexes |
| `20260731150000_sale_price_and_schema_gaps.sql` | sale_price + options_snapshot |
| `20260802120000_integrity_fks_payment_guards.sql` | FKs, uniques, triggers, dedupe |

Support/chat tables (`support_*`, `chat_conversations`, etc.) were restored from Supabase dump — not all are in early migrations.

## Corrective migration notes

`20260802120000` includes data dedupe (duplicate payments + inventory movements). Backup taken before apply:

`/data/fleet/backups/rme/rme_staging_commerce_20260802_125729.sql`

## Rollback

1. Restore commerce tables from the backup dump.  
2. Drop new indexes/triggers/FKs by name if needed.  
3. Redeploy prior app commit if payment code must roll back.

## Pending

None for schema. App deploy of REST auth + payment code must follow this report.
