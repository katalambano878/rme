#!/usr/bin/env bash
set -euo pipefail
TOKEN="$(cat /data/fleet/secrets/coolify-api.token)"
API="http://127.0.0.1:8000/api/v1"
H=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")
DEP="${1:-p1g99n5xppxbgjdmm2odwd7p}"
curl -sS "${H[@]}" "$API/deployments/$DEP" | jq '{status, commit, message}'
curl -sS "${H[@]}" "$API/deployments/$DEP" | jq -r '(.logs|fromjson|map(select(.hidden!=true)|.output)|.[-40:])[]' 2>/dev/null | tail -40
sudo fleet apps 2>/dev/null | grep trustecom || true
curl -sS -o /dev/null -w "health_http=%{http_code}\n" "https://trustecom-staging.169-58-8-203.sslip.io/api/health" || true
curl -sS "https://trustecom-staging.169-58-8-203.sslip.io/api/health" | head -c 800 || true
echo
