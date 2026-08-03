#!/usr/bin/env bash
set -euo pipefail

source /data/fleet/secrets/db-stack.env
source /data/fleet/secrets/store_trustecom.env

HOST="${PGHOST:-${POSTGRES_HOST:-127.0.0.1}}"
PORT="${PGPORT:-${POSTGRES_PORT:-5432}}"
USER_NAME="${PGUSER:-store_trustecom}"
DB_NAME="${PGDATABASE:-store_trustecom}"
export PGPASSWORD="${STORE_PASS:?STORE_PASS missing}"

echo "Connecting as $USER_NAME@$HOST:$PORT/$DB_NAME"
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_unique ON auth.users (lower(email));
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;
SQL
echo "OK"
