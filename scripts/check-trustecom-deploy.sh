#!/usr/bin/env bash
set -euo pipefail
TOKEN="$(cat /data/fleet/secrets/coolify-api.token)"
API="http://127.0.0.1:8000/api/v1"
H=(-H "Authorization: Bearer ${TOKEN}")
APP="ok4shl2c5fhrbg22zs55yk3l"
DEP="i1lc9gxou31awvl5cvx2ndwg"

echo "==> deployment status"
curl -sS "${H[@]}" "$API/deployments/$DEP" | jq '{status, commit, created_at, updated_at}'

echo "==> last log lines"
curl -sS "${H[@]}" "$API/deployments/$DEP" | jq -r '
  (.logs|fromjson|map(select(.hidden!=true)|.output)|.[-40:])[]
' 2>/dev/null || curl -sS "${H[@]}" "$API/deployments/$DEP" | jq -r '.logs' | tail -c 8000

echo "==> app"
curl -sS "${H[@]}" "$API/applications/$APP" | jq '{name,uuid,git_branch,fqdn,build_pack,ports_exposes,status}'

echo "==> fleet"
sudo fleet apps 2>/dev/null | grep -E 'trustecom|rme-staging' || true
