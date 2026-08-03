#!/usr/bin/env bash
# Run ON big-vps with sudo. Prints a ready-to-use .env.local body to stdout.
set -euo pipefail
source /data/fleet/secrets/db-stack.env
source /data/fleet/secrets/store_trustecom.env

HOST="${PGHOST:-${POSTGRES_HOST:-127.0.0.1}}"
PORT="${PGPORT:-${POSTGRES_PORT:-5432}}"
# Prefer pgbouncer if configured
if [[ -n "${PGBOUNCER_PORT:-}" ]]; then
  PORT="$PGBOUNCER_PORT"
fi
# fleet often exposes pgbouncer on 6432
if [[ -z "${PGBOUNCER_PORT:-}" ]] && (ss -lntp 2>/dev/null | grep -q ':6432'); then
  PORT=6432
fi

USER_NAME="${PGUSER:-store_trustecom}"
DB_NAME="${PGDATABASE:-store_trustecom}"
PASS="${STORE_PASS:?STORE_PASS missing}"
AUTH="$(openssl rand -hex 32)"

# URL-encode password minimally
ENC_PASS="$(python3 - <<'PY' "$PASS"
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1], safe=''))
PY
)"

# From Windows machine we will SSH-tunnel, so local DATABASE_URL uses localhost tunnel port.
# This script only prints the remote pieces; the Windows wrapper builds the file.
echo "STORE_USER=$USER_NAME"
echo "STORE_DB=$DB_NAME"
echo "STORE_HOST=$HOST"
echo "STORE_PORT=$PORT"
echo "STORE_PASS_ENC=$ENC_PASS"
echo "AUTH_SECRET=$AUTH"
