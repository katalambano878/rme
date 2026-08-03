#!/usr/bin/env bash
set -euo pipefail
TOKEN="$(cat /data/fleet/secrets/coolify-api.token)"
API="http://127.0.0.1:8000/api/v1"
H=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")
APP_UUID="ok4shl2c5fhrbg22zs55yk3l"

set_env() {
  local key="$1" value="$2"
  local resp
  resp="$(curl -sS -X POST "${H[@]}" "$API/applications/$APP_UUID/envs" -d "$(jq -n \
    --arg key "$key" --arg value "$value" \
    '{key:$key, value:$value, is_literal:true, is_preview:false, is_multiline:false, is_buildtime:false, is_runtime:true}')")"
  if echo "$resp" | jq -e '.uuid' >/dev/null 2>&1; then
    echo "  + $key"
    return
  fi
  local uuid
  uuid="$(curl -sS "${H[@]}" "$API/applications/$APP_UUID/envs" | jq -r --arg k "$key" '.[] | select(.key==$k) | .uuid' | head -1)"
  if [[ -n "$uuid" && "$uuid" != "null" ]]; then
    curl -sS -X PATCH "${H[@]}" "$API/applications/$APP_UUID/envs/$uuid" -d "$(jq -n \
      --arg key "$key" --arg value "$value" \
      '{key:$key, value:$value, is_literal:true, is_buildtime:false, is_runtime:true}')" >/dev/null
    echo "  ~ $key"
    return
  fi
  echo "  ! $key failed: $resp"
}

# Keep existing AUTH_SECRET if already set
EXISTING="$(curl -sS "${H[@]}" "$API/applications/$APP_UUID/envs" | jq -r '.[] | select(.key=="AUTH_SECRET") | .value' | head -1)"
if [[ -n "${EXISTING}" && "${EXISTING}" != "null" ]]; then
  echo "AUTH_SECRET already set — leaving unchanged"
else
  SECRET="$(openssl rand -hex 32)"
  set_env "AUTH_SECRET" "$SECRET"
fi

set_env "AUTH_COOKIE_NAME" "trustecom_session"
set_env "AUTH_COOKIE_MAX_AGE_DAYS" "7"
set_env "UPLOAD_DIR" "/var/www/trustecom/uploads"
set_env "NEXT_PUBLIC_UPLOAD_BASE_URL" "https://trustecom-staging.169-58-8-203.sslip.io/uploads"

mkdir -p /var/www/trustecom/uploads
chown -R 1000:1000 /var/www/trustecom 2>/dev/null || true

echo "==> env keys (names only)"
curl -sS "${H[@]}" "$API/applications/$APP_UUID/envs" | jq -r '.[].key' | sort
