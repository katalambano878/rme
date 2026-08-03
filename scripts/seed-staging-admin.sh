#!/usr/bin/env bash
set -euo pipefail
# Seeds a staging admin if TRUSTECOM_ADMIN_EMAIL/PASSWORD are provided in env,
# otherwise prints instructions. Does not invent passwords.

source /data/fleet/secrets/db-stack.env
source /data/fleet/secrets/store_trustecom.env

EMAIL="${TRUSTECOM_ADMIN_EMAIL:-}"
PASS="${TRUSTECOM_ADMIN_PASSWORD:-}"

if [[ -z "$EMAIL" || -z "$PASS" ]]; then
  echo "Set TRUSTECOM_ADMIN_EMAIL and TRUSTECOM_ADMIN_PASSWORD to seed an admin."
  echo "Example (on VPS):"
  echo "  TRUSTECOM_ADMIN_EMAIL=admin@trustecom.com TRUSTECOM_ADMIN_PASSWORD='...' sudo -E bash $0"
  exit 0
fi

HASH="$(docker run --rm node:22-alpine node -e "const b=require('bcryptjs'); b.hash(process.argv[1],12).then(console.log)" "$PASS" 2>/dev/null || true)"
if [[ -z "$HASH" ]]; then
  # fallback: use python bcrypt if available, else openssl placeholder fail
  echo "Need bcrypt hash — install bcryptjs in a node container failed."
  exit 1
fi

export PGPASSWORD="${STORE_PASS}"
docker exec -e PGPASSWORD="$STORE_PASS" -i fleet-postgres \
  psql -U store_trustecom -d store_trustecom -v ON_ERROR_STOP=1 \
  -v email="$EMAIL" -v hash="$HASH" <<'SQL'
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (:'email', :'hash', now(), '{}'::jsonb)
ON CONFLICT DO NOTHING;
-- if unique on lower(email) only, handle update path:
UPDATE auth.users SET encrypted_password = :'hash', email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE lower(email) = lower(:'email');

INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin' FROM auth.users WHERE lower(email) = lower(:'email')
ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email, updated_at = now();

SELECT id, email FROM auth.users WHERE lower(email) = lower(:'email');
SQL
echo "Admin seeded for $EMAIL"
