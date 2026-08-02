# Database Recovery Guide — RME Staging

## Confirm target

```bash
ssh big-vps
sudo docker exec fleet-postgres psql -U postgres -d rme_staging -c "SELECT current_database(), version();"
```

Must show database `rme_staging` — not another store_* DB.

## Backup (commerce snapshot)

```bash
TS=$(date +%Y%m%d_%H%M%S)
sudo docker exec fleet-postgres pg_dump -U postgres -d rme_staging \
  --table=public.orders --table=public.order_items --table=public.payments \
  --table=public.products --table=public.variants \
  > /data/fleet/backups/rme/rme_staging_commerce_$TS.sql
```

Full DB:

```bash
sudo docker exec fleet-postgres pg_dump -U postgres -d rme_staging \
  > /data/fleet/backups/rme/rme_staging_full_$TS.sql
```

Known backup from integrity migration:  
`/data/fleet/backups/rme/rme_staging_commerce_20260802_125729.sql`

## Restore commerce tables

```bash
# Destructive — truncates then reloads dump contents carefully.
# Prefer restore into a scratch DB first when unsure.
sudo docker exec -i fleet-postgres psql -U postgres -d rme_staging \
  < /data/fleet/backups/rme/rme_staging_commerce_YYYYMMDD_HHMMSS.sql
```

## Apply migrations

```bash
sudo docker exec -i fleet-postgres psql -U postgres -d rme_staging -v ON_ERROR_STOP=1 \
  < supabase/migrations/YYYYMMDDHHMMSS_*.sql
```

## Verify after restore

```bash
curl -sS https://ronnyandme.com/api/health/db
sudo docker exec fleet-postgres psql -U postgres -d rme_staging -c \
  "SELECT count(*) FROM orders; SELECT count(*) FROM payments WHERE status='paid';"
```

## App rollback

Redeploy previous Coolify deployment / git commit on `staging/plain-postgres` if application logic must revert.
