#!/usr/bin/env bash
set -euo pipefail

: "${API_URL:?Set API_URL to the api_url output of terraform}"
: "${API_KEY:?Set API_KEY to the value stored in the api key secret}"

key="$(node -p "crypto.randomUUID()")"
now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

payload=$(cat <<JSON
{
  "readings": [
    {
      "idempotencyKey": "${key}",
      "deviceId": "sensor-01",
      "metric": "temperature",
      "value": 78.8,
      "unit": "F",
      "recordedAt": "${now}"
    }
  ]
}
JSON
)

send() {
  curl -sS -w "\nHTTP %{http_code}\n" \
    -X POST "${API_URL}/readings" \
    -H "content-type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -d "${payload}"
}

echo "First request:"
send
echo
echo "Same request again (should be reported as a duplicate):"
send
