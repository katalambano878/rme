#!/usr/bin/env bash
# Make NODE_ENV runtime-only so nixpacks installs devDependencies during build.
set -euo pipefail
TOKEN="$(cat /data/fleet/secrets/coolify-api.token)"
API="http://127.0.0.1:8000/api/v1"
H=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")
APP="ok4shl2c5fhrbg22zs55yk3l"

echo "==> list env keys"
curl -sS "${H[@]}" "$API/applications/$APP/envs" | jq -r '.[] | [.key, .uuid, .is_buildtime, .is_runtime] | @tsv'

NODE_UUID="$(curl -sS "${H[@]}" "$API/applications/$APP/envs" | jq -r '.[] | select(.key=="NODE_ENV") | .uuid' | head -1)"
echo "NODE_ENV uuid=$NODE_UUID"

if [[ -n "$NODE_UUID" ]]; then
  curl -sS -X PATCH "${H[@]}" "$API/applications/$APP/envs/$NODE_UUID" -d '{
    "key": "NODE_ENV",
    "value": "production",
    "is_literal": true,
    "is_buildtime": false,
    "is_runtime": true,
    "is_preview": false,
    "is_multiline": false
  }' | jq '{key,uuid,is_buildtime,is_runtime,message}' || true
fi

# Wait for current deploy if still running, then force redeploy
echo "==> wait current deploy"
for i in $(seq 1 90); do
  ST="$(curl -sS "${H[@]}" "$API/deployments/i1lc9gxou31awvl5cvx2ndwg" | jq -r '.status // empty')"
  echo "[$i] $ST"
  if [[ -z "$ST" || "$ST" == "finished" || "$ST" == "failed" || "$ST" == "error" ]]; then break; fi
  sleep 10
done

echo "==> force redeploy"
RESP="$(curl -sS -X POST "${H[@]}" "$API/deploy?uuid=${APP}&force=true")"
echo "$RESP" | jq .
DEP="$(echo "$RESP" | jq -r '.deployments[0].deployment_uuid // empty')"
echo "NEW_DEP=$DEP"

if [[ -n "$DEP" ]]; then
  for i in $(seq 1 90); do
    DEP_JSON="$(curl -sS "${H[@]}" "$API/deployments/$DEP")"
    DEP_STATUS="$(echo "$DEP_JSON" | jq -r '.status // empty')"
    echo "[redeploy $i] $DEP_STATUS"
    if [[ "$DEP_STATUS" == "finished" || "$DEP_STATUS" == "failed" || "$DEP_STATUS" == "error" ]]; then
      curl -sS "${H[@]}" "$API/deployments/$DEP" | jq -r '(.logs|fromjson|map(select(.hidden!=true)|.output)|.[-25:])[]' 2>/dev/null || true
      break
    fi
    sleep 10
  done
fi

sudo fleet apps 2>/dev/null | grep -E 'trustecom|rme-staging' || true
