#!/usr/bin/env bash
set -euo pipefail
TOKEN="$(cat /data/fleet/secrets/coolify-api.token)"
API="http://127.0.0.1:8000/api/v1"
H=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")
DEP="${1:-mhnjoah6zbrzw47psqa8e8r5}"
curl -sS "${H[@]}" "$API/deployments/$DEP" | jq -r '
  (.logs|fromjson|map(select(.hidden!=true)|.output)|.[-60:])[]
' 2>/dev/null || curl -sS "${H[@]}" "$API/deployments/$DEP" | jq '{status, commit, message}' 
