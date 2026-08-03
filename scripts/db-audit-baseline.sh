#!/usr/bin/env bash
set -euo pipefail

# Confirm staging DB identity without printing passwords.
source /data/fleet/secrets/store_trustecom.env
DB=store_trustecom
ROLE=store_trustecom

echo "==> Target database (staging fleet)"
echo "    database=$DB"
echo "    role=$ROLE"
echo "    host=fleet-postgres (direct) / fleet-pgbouncer (app pool)"
echo "    password_set=$([ -n "${STORE_PASS:-}" ] && echo yes || echo no)"

echo "==> PostgreSQL version + table inventory"
docker exec -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  psql -U "$ROLE" -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
SELECT version();
SELECT current_database() AS db, current_user AS db_user;
SELECT count(*) AS public_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
\dt public.*
SQL

echo "==> Coolify app env keys (names only)"
TOKEN="$(cat /data/fleet/secrets/coolify-api.token)"
curl -sS -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8000/api/v1/applications/ok4shl2c5fhrbg22zs55yk3l/envs" \
  | jq -r '.[].key' | sort -u

echo "==> App status"
sudo fleet apps 2>/dev/null | grep -E 'trustecom|rme-staging' || true
