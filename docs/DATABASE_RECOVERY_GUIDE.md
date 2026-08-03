# Database Recovery Guide — Trust Ecom (`store_trustecom`)

**Target database:** `store_trustecom`  
**Host:** big VPS — `fleet-postgres` container  
**Role:** `store_trustecom`  
**Secrets file:** `/data/fleet/secrets/store_trustecom.env`

This guide covers backup and restore for the **plain Postgres** staging database. It does **not** replace Supabase project backups while the application still runs on Supabase in production.

---

## 1. Before you begin

### 1.1 Confirm the correct database

**Always verify** you are operating on `store_trustecom`, not another store (e.g. `store_mamator`, rme-staging DB).

```bash
ssh big-vps
source /data/fleet/secrets/store_trustecom.env
docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  psql -U store_trustecom -d store_trustecom -c \
  "SELECT current_database(), current_user;"
```

Expected: `store_trustecom` / `store_trustecom`.

### 1.2 Unrelated apps

| App | Database |
|-----|----------|
| **trustecom-staging** | `store_trustecom` ← this guide |
| **rme-staging** | Different — **do not restore here** |

---

## 2. Backup with pg_dump

Fleet Postgres runs in Docker as `fleet-postgres`. Backups use `pg_dump` from inside or against that container.

### 2.1 Logical backup (recommended)

Custom format (supports parallel restore, selective tables):

```bash
ssh big-vps
source /data/fleet/secrets/store_trustecom.env

BACKUP_DIR="/data/fleet/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="${BACKUP_DIR}/store_trustecom_${STAMP}.dump"

mkdir -p "$BACKUP_DIR"

docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  pg_dump -U store_trustecom -d store_trustecom \
  -Fc --no-owner --no-acl \
  -f "/tmp/store_trustecom_${STAMP}.dump"

docker cp "fleet-postgres:/tmp/store_trustecom_${STAMP}.dump" "$FILE"
docker exec fleet-postgres rm -f "/tmp/store_trustecom_${STAMP}.dump"

echo "Backup written: $FILE"
ls -lh "$FILE"
```

Plain SQL (human-readable, larger files):

```bash
docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  pg_dump -U store_trustecom -d store_trustecom \
  --no-owner --no-acl \
  > "/data/fleet/backups/store_trustecom_${STAMP}.sql"
```

### 2.2 What to include

| Scope | Command flag | Use case |
|-------|--------------|----------|
| Full database | (default) | Disaster recovery |
| Schema only | `--schema-only` | Compare DDL drift |
| Data only | `--data-only` | Re-seed after schema apply |
| Single table | `-t public.orders` | Surgical export |

### 2.3 Pre-backup checklist

- [ ] Confirm database name `store_trustecom`
- [ ] Note migration IDs: `SELECT id FROM schema_migrations ORDER BY id;`
- [ ] Stop or pause writes if you need a strictly consistent snapshot (optional for staging)
- [ ] Verify disk space under `/data/fleet/backups`

### 2.4 When to backup

| Event | Action |
|-------|--------|
| Before re-running `apply-store-trustecom-schema.sh` with new DDL | Full dump |
| Before data import from Supabase | Full dump |
| Before manual DELETE/UPDATE | Full dump or table dump |
| Scheduled staging | Daily or weekly (recommended once app uses PG) |

Fleet may already store backups under `/data/fleet/backups` — inventory with:

```bash
ssh big-vps 'ls -lah /data/fleet/backups/ | grep trustecom || ls -lah /data/fleet/backups/ | tail'
```

---

## 3. Restore

### 3.1 Full restore from custom format (destructive)

**Warning:** This overwrites objects in the target database. Use staging only unless approved for production.

```bash
ssh big-vps
source /data/fleet/secrets/store_trustecom.env
FILE="/data/fleet/backups/store_trustecom_YYYYMMDD_HHMMSS.dump"

# Optional: drop all public objects (staging reset) — use with extreme care
# docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
#   psql -U store_trustecom -d store_trustecom -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

docker cp "$FILE" "fleet-postgres:/tmp/restore.dump"

docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  pg_restore -U store_trustecom -d store_trustecom \
  --no-owner --no-acl --clean --if-exists \
  /tmp/restore.dump

docker exec fleet-postgres rm -f /tmp/restore.dump
```

### 3.2 Restore from plain SQL

```bash
docker exec -i -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  psql -U store_trustecom -d store_trustecom -v ON_ERROR_STOP=1 \
  < "/data/fleet/backups/store_trustecom_YYYYMMDD_HHMMSS.sql"
```

### 3.3 Partial restore (single table)

```bash
docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  pg_restore -U store_trustecom -d store_trustecom \
  --no-owner --no-acl -t public.orders \
  /tmp/restore.dump
```

### 3.4 Post-restore verification

```bash
# Table count
docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  psql -U store_trustecom -d store_trustecom -c \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public';"

# Migration bookkeeping
docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  psql -U store_trustecom -d store_trustecom -c \
  "SELECT * FROM schema_migrations ORDER BY applied_at;"

# Integrity dry-run
bash scripts/db-integrity-dry-run.sh

# App health (if deployed)
curl -sS https://<trustecom-staging-host>/api/health | jq '.database'
```

---

## 4. Disaster recovery scenarios

### 4.1 Schema accidentally broken

1. Restore latest pre-change dump **or**
2. Re-run `scripts/apply-store-trustecom-schema.sh` (idempotent for DDL; does not restore deleted data)

### 4.2 Data accidentally deleted

1. Restore from backup taken before deletion
2. If no backup: data is **not recoverable** from Postgres WAL without point-in-time recovery (PITR) — PITR not documented for this VPS; confirm with fleet admin

### 4.3 Wrong database targeted

If commands were run against wrong DB: stop immediately, assess damage on that DB, restore that DB from its own backup. **Never** restore `store_mamator` dump into `store_trustecom` or vice versa.

### 4.4 Complete database loss

1. `sudo fleet db provision trustecom` (if DB dropped — confirm with fleet)
2. Restore from latest `pg_dump`
3. Re-apply any migrations missing from dump if restore is partial
4. Run integrity dry-run and health check

---

## 5. Connection URLs for restore tools

| Purpose | Typical URL |
|---------|-------------|
| App runtime (pooled) | `DATABASE_URL` → `fleet-pgbouncer:6432/store_trustecom` |
| Direct admin / restore | `DIRECT_URL` → `fleet-postgres:5432/store_trustecom` |

Use **direct** connection for long-running `pg_dump` / `pg_restore` to avoid pgbouncer transaction pooling issues with some DDL.

---

## 6. Supabase-era recovery (still relevant)

While production traffic uses Supabase:

- **Postgres data:** Supabase Dashboard → Database → Backups (managed)
- **Storage objects:** Supabase Storage export or bucket sync
- **Auth users:** Supabase Auth export / admin API

A full Trust Ecom recovery today may require **both** Supabase backups (live app) and `store_trustecom` backups (staging cutover work).

After cutover completes, Supabase backups become historical only.

---

## 7. Security notes

- Never commit `/data/fleet/secrets/store_trustecom.env` or dump files to git
- Restrict backup file permissions: `chmod 600` on dumps containing PII (orders, profiles, emails)
- Transfer dumps over SSH/SCP only

---

## 8. Quick reference

```bash
# Backup
source /data/fleet/secrets/store_trustecom.env
docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  pg_dump -U store_trustecom -d store_trustecom -Fc -f /tmp/b.dump && \
docker cp fleet-postgres:/tmp/b.dump ./store_trustecom_backup.dump

# Restore
docker cp ./store_trustecom_backup.dump fleet-postgres:/tmp/b.dump
docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  pg_restore -U store_trustecom -d store_trustecom --clean --if-exists /tmp/b.dump

# Verify
docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  psql -U store_trustecom -d store_trustecom -c "\dt public.*"
```

---

## Related documents

- [MIGRATION_STATUS_REPORT.md](./MIGRATION_STATUS_REPORT.md) — schema apply and rollback
- [DATABASE_AUDIT_AND_REPAIR_REPORT.md](./DATABASE_AUDIT_AND_REPAIR_REPORT.md) — environment inventory
- [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) — table list for selective restore
