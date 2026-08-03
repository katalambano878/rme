#!/usr/bin/env bash
# Create Coolify staging for Trust Ecom — independent of rme-staging / RonnyandMe.
set -euo pipefail

TOKEN="$(cat /data/fleet/secrets/coolify-api.token)"
API="${COOLIFY_API:-http://127.0.0.1:8000/api/v1}"
H=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")

SERVER_UUID="d11ltfeuj6qtltuts2lx8f7l"
DEST_UUID="y1437r4odlo133ltek1l5uyb"

PROJECT_NAME="trustecom"
APP_NAME="trustecom-staging"
# Source branch is Trust Ecom only (not rme-staging Coolify app / not ronnyandme.com).
# Retarget to a dedicated github.com/.../trust-ecom.git repo when that remote exists.
GIT_REPO="https://github.com/katalambano878/rme.git"
GIT_BRANCH="staging/trustecom"
DOMAIN="https://trustecom-staging.169-58-8-203.sslip.io"
PORT="3000"

STORE_SECRETS="/data/fleet/secrets/store_trustecom.env"
if [[ ! -f "$STORE_SECRETS" ]]; then
  echo "Missing $STORE_SECRETS — run: sudo fleet db provision trustecom"
  exit 1
fi
# shellcheck disable=SC1090
source "$STORE_SECRETS"
STORE_PASS="${STORE_PASS:?}"

DATABASE_URL="postgres://store_trustecom:${STORE_PASS}@fleet-pgbouncer:6432/store_trustecom"
DIRECT_URL="postgres://store_trustecom:${STORE_PASS}@fleet-postgres:5432/store_trustecom"

echo "==> ensure uploads dir (local disk, not Supabase)"
mkdir -p /var/www/trustecom/uploads
chmod 755 /var/www/trustecom /var/www/trustecom/uploads || true
chown -R 1000:1000 /var/www/trustecom 2>/dev/null || true

# Refuse to touch RME
EXISTING_RME="$(curl -sS "${H[@]}" "$API/applications" | jq -r '.[] | select(.name=="rme-staging") | .uuid' | head -1 || true)"
echo "==> rme-staging left untouched (uuid=${EXISTING_RME:-none})"

PROJECT_UUID="$(curl -sS "${H[@]}" "$API/projects" | jq -r --arg n "$PROJECT_NAME" '.[] | select(.name==$n) | .uuid' | head -1)"
if [[ -z "$PROJECT_UUID" ]]; then
  echo "==> create Coolify project: $PROJECT_NAME"
  PROJECT_UUID="$(curl -sS -X POST "${H[@]}" "$API/projects" -d "$(jq -n \
    --arg name "$PROJECT_NAME" \
    --arg description "Trust Ecom storefront staging (independent of RonnyandMe/RME)" \
    '{name:$name, description:$description}')" | jq -r '.uuid // empty')"
  [[ -n "$PROJECT_UUID" ]] || { echo "failed to create project"; exit 1; }
else
  echo "==> project exists: $PROJECT_UUID"
fi

ENV_UUID="$(curl -sS "${H[@]}" "$API/projects/$PROJECT_UUID" | jq -r '.environments[] | select(.name=="production") | .uuid' | head -1)"
echo "PROJECT_UUID=$PROJECT_UUID ENV_UUID=$ENV_UUID"

APP_UUID="$(curl -sS "${H[@]}" "$API/applications" | jq -r --arg n "$APP_NAME" '.[] | select(.name==$n) | .uuid' | head -1)"
if [[ -z "$APP_UUID" ]]; then
  echo "==> create application: $APP_NAME"
  CREATE_RESP="$(curl -sS -X POST "${H[@]}" "$API/applications/public" -d "$(jq -n \
    --arg project_uuid "$PROJECT_UUID" \
    --arg server_uuid "$SERVER_UUID" \
    --arg environment_name "production" \
    --arg environment_uuid "$ENV_UUID" \
    --arg destination_uuid "$DEST_UUID" \
    --arg git_repository "$GIT_REPO" \
    --arg git_branch "$GIT_BRANCH" \
    --arg build_pack "nixpacks" \
    --arg ports_exposes "$PORT" \
    --arg name "$APP_NAME" \
    --arg description "Trust Ecom staging — Next.js storefront (not RME)" \
    --arg domains "$DOMAIN" \
    --argjson instant_deploy false \
    --argjson is_auto_deploy_enabled false \
    --argjson autogenerate_domain false \
    '{
      project_uuid: $project_uuid,
      server_uuid: $server_uuid,
      environment_name: $environment_name,
      environment_uuid: $environment_uuid,
      destination_uuid: $destination_uuid,
      git_repository: $git_repository,
      git_branch: $git_branch,
      build_pack: $build_pack,
      ports_exposes: $ports_exposes,
      name: $name,
      description: $description,
      domains: $domains,
      instant_deploy: $instant_deploy,
      is_auto_deploy_enabled: $is_auto_deploy_enabled,
      autogenerate_domain: $autogenerate_domain
    }')")"
  echo "$CREATE_RESP" | jq .
  APP_UUID="$(echo "$CREATE_RESP" | jq -r '.uuid // empty')"
  [[ -n "$APP_UUID" ]] || { echo "FAILED creating app"; exit 1; }
else
  echo "==> app already exists: $APP_UUID"
  curl -sS -X PATCH "${H[@]}" "$API/applications/$APP_UUID" -d "$(jq -n \
    --arg name "$APP_NAME" \
    --arg git_repository "$GIT_REPO" \
    --arg git_branch "$GIT_BRANCH" \
    --arg fqdn "$DOMAIN" \
    --arg ports_exposes "$PORT" \
    --arg build_pack "nixpacks" \
    '{
      name: $name,
      git_repository: $git_repository,
      git_branch: $git_branch,
      fqdn: $fqdn,
      ports_exposes: $ports_exposes,
      build_pack: $build_pack
    }')" | jq '{uuid,name,fqdn,git_repository,ports_exposes,build_pack}' || true
fi

echo "APP_UUID=$APP_UUID"

set_env() {
  local key="$1" value="$2"
  local resp
  resp="$(curl -sS -X POST "${H[@]}" "$API/applications/$APP_UUID/envs" -d "$(jq -n \
    --arg key "$key" --arg value "$value" \
    '{key:$key, value:$value, is_literal:true, is_preview:false, is_multiline:false}')")"
  if echo "$resp" | jq -e '.uuid' >/dev/null 2>&1; then
    echo "  + $key"
    return
  fi
  resp="$(curl -sS -X PATCH "${H[@]}" "$API/applications/$APP_UUID/envs" -d "$(jq -n \
    --arg key "$key" --arg value "$value" \
    '{key:$key, value:$value, is_literal:true}')")"
  if echo "$resp" | jq -e '.uuid // .message' >/dev/null 2>&1; then
    echo "  ~ $key"
    return
  fi
  echo "  ! $key failed: $resp"
}

echo "==> wire Trust Ecom env (no RME / RonnyandMe values)"
set_env "NODE_ENV" "production"
set_env "NEXT_PUBLIC_APP_URL" "$DOMAIN"
set_env "APP_BASE_URL" "$DOMAIN"
set_env "DATABASE_URL" "$DATABASE_URL"
set_env "DIRECT_URL" "$DIRECT_URL"
set_env "PORT" "$PORT"
set_env "HOSTNAME" "0.0.0.0"

# Explicitly clear any accidental RME branding envs if present
set_env "MOOLRE_SMS_SENDER_ID" "TrustEcom"

echo ""
echo "==> DONE"
echo "    App:     $APP_NAME ($APP_UUID)"
echo "    Project: $PROJECT_NAME ($PROJECT_UUID)"
echo "    URL:     $DOMAIN"
echo "    Git:     $GIT_REPO ($GIT_BRANCH)"
echo "    DB:      store_trustecom via fleet-pgbouncer"
echo "    Uploads: /var/www/trustecom/uploads"
echo ""
echo "NOTE: Deploy only after https://github.com/katalambano878/trust-ecom exists and has this code."
echo "      rme-staging was NOT modified."
echo "      Still need Supabase (or later plain-auth) keys in Coolify UI before a successful boot."
