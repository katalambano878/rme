#!/usr/bin/env bash
set -euo pipefail

source /data/fleet/secrets/db-stack.env
source /data/fleet/secrets/store_trustecom.env

USER_NAME="${PGUSER:-store_trustecom}"
DB_NAME="${PGDATABASE:-store_trustecom}"
PASS="${STORE_PASS:?STORE_PASS missing}"

# Prefer dockerized postgres client on fleet-postgres
CONTAINER="${FLEET_POSTGRES_CONTAINER:-fleet-postgres}"
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'postgres|pgbouncer' | head -1 || true)
fi

if [[ -z "${CONTAINER}" ]]; then
  echo "No postgres container found" >&2
  docker ps --format '{{.Names}}' | head -20
  exit 1
fi

echo "Using container: $CONTAINER as $USER_NAME/$DB_NAME"
docker exec -e PGPASSWORD="$PASS" -i "$CONTAINER" \
  psql -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_unique ON auth.users (lower(email));
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;
SQL
echo "OK"
