#!/usr/bin/env bash
set -euo pipefail
TOKEN="$(cat /data/fleet/secrets/coolify-api.token)"
API="http://127.0.0.1:8000/api/v1"
H=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")
DEP=p1g99n5xppxbgjdmm2odwd7p

echo "==> deployment"
curl -sS "${H[@]}" "$API/deployments/$DEP" | jq '{status, commit, created_at, updated_at}'

echo "==> docker builders / helpers"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | head -40

echo "==> recent build containers"
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep -E 'p1g99|coolify-helper|nixpacks' | head -20 || true

# Fix NODE_ENV buildtime on app
APP=ok4shl2c5fhrbg22zs55yk3l
NODE_UUID="$(curl -sS "${H[@]}" "$API/applications/$APP/envs" | jq -r '.[] | select(.key=="NODE_ENV") | .uuid' | head -1)"
echo "NODE_ENV uuid=$NODE_UUID"
if [[ -n "$NODE_UUID" && "$NODE_UUID" != "null" ]]; then
  curl -sS -X PATCH "${H[@]}" "$API/applications/$APP/envs/$NODE_UUID" -d '{
    "key": "NODE_ENV",
    "value": "production",
    "is_literal": true,
    "is_buildtime": false,
    "is_runtime": true,
    "is_preview": false,
    "is_multiline": false
  }' | jq '{key,is_buildtime,is_runtime}' || true
fi
