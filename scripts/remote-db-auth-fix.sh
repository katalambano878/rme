#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/data/fleet/secrets/store_trustecom.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

echo "Secret keys present:"
grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | cut -d= -f1

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

URL="${DATABASE_URL:-${DIRECT_URL:-${POSTGRES_URL:-}}}"
if [[ -z "${URL}" ]]; then
  echo "No DATABASE_URL/DIRECT_URL/POSTGRES_URL in secrets file" >&2
  exit 1
fi

psql "$URL" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_unique ON auth.users (lower(email));
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;
SQL

echo "OK: auth.users session columns applied"
