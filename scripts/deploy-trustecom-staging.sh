#!/usr/bin/env bash
set -euo pipefail
TOKEN="$(cat /data/fleet/secrets/coolify-api.token)"
API="http://127.0.0.1:8000/api/v1"
H=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")
APP_UUID="ok4shl2c5fhrbg22zs55yk3l"

echo "==> deploy trustecom-staging via Coolify API"
RESP="$(curl -sS -X POST "${H[@]}" "$API/deploy?uuid=${APP_UUID}&force=true")"
echo "$RESP" | jq .
DEP="$(echo "$RESP" | jq -r '.deployments[0].deployment_uuid // empty')"
echo "DEP=$DEP"

if [[ -n "$DEP" ]]; then
  for i in $(seq 1 60); do
    DEP_JSON="$(curl -sS "${H[@]}" "$API/deployments/$DEP")"
    DEP_STATUS="$(echo "$DEP_JSON" | jq -r '.status // empty')"
    echo "[$i] deploy=$DEP_STATUS"
    if [[ "$DEP_STATUS" == "finished" || "$DEP_STATUS" == "failed" || "$DEP_STATUS" == "error" ]]; then
      echo "$DEP_JSON" | jq '{status, commit, message}' || true
      break
    fi
    sleep 10
  done
fi

echo "==> fleet status"
sudo fleet apps 2>/dev/null | grep -E 'trustecom|rme-staging' || true
