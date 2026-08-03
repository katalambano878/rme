#!/usr/bin/env bash
set -euo pipefail
set -a
# shellcheck disable=SC1091
. /data/fleet/secrets/store_trustecom.env
set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_unique ON auth.users (lower(email));
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;
SQL
