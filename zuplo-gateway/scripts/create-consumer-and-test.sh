#!/usr/bin/env bash
# Create a Zuplo API key consumer and test the gateway from CLI.
#
# Prerequisites (set in zuplo-gateway/.env or export):
#   - ZUPLO_API_KEY: Portal → Settings → API Keys
#   - ZUPLO_ACCOUNT_NAME: from portal URL (e.g. portal.zuplo.com/ACCOUNT/PROJECT)
#   - ZUPLO_BUCKET_NAME: Portal → Project → Settings → Project Information (or bucketName in config/policies.json)
#   - GATEWAY_URL: Portal → Environments → <env> → Gateway URL
#
# Usage:
#   cd zuplo-gateway && ./scripts/create-consumer-and-test.sh
#   Or: GATEWAY_URL=https://... ./scripts/create-consumer-and-test.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$GATEWAY_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

CONSUMER_NAME="${ZUPLO_CONSUMER_NAME:-test-consumer-cli}"
API_BASE="https://dev.zuplo.com/v1"

for var in ZUPLO_API_KEY ZUPLO_ACCOUNT_NAME ZUPLO_BUCKET_NAME GATEWAY_URL; do
  if [[ -z "${!var}" ]]; then
    echo "Error: $var is required. Set it in zuplo-gateway/.env or export it."
    echo "  ZUPLO_ACCOUNT_NAME: from portal URL (e.g. portal.zuplo.com/ACCOUNT/PROJECT)"
    echo "  ZUPLO_BUCKET_NAME: Portal → Project → Settings → Project Information"
    echo "  GATEWAY_URL: Portal → Environments → main (or working-copy) → Gateway"
    exit 1
  fi
done

echo "Creating consumer '$CONSUMER_NAME' in bucket $ZUPLO_BUCKET_NAME..."
RESPONSE=$(curl -s -X POST \
  "${API_BASE}/accounts/${ZUPLO_ACCOUNT_NAME}/key-buckets/${ZUPLO_BUCKET_NAME}/consumers?with-api-key=true" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ZUPLO_API_KEY}" \
  -d "{\"name\": \"${CONSUMER_NAME}\", \"description\": \"Test consumer created from CLI\"}")

if echo "$RESPONSE" | grep -q '"key"'; then
  API_KEY=$(echo "$RESPONSE" | jq -r '.apiKeys[0].key')
  echo "Consumer created. API key: ${API_KEY:0:20}..."
  echo ""
  echo "Testing gateway at $GATEWAY_URL/api/health ..."
  curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "Authorization: Bearer $API_KEY" \
    "$GATEWAY_URL/api/health"
  echo ""
  echo "Add to zuplo-gateway/.env: ZUPLO_CONSUMER_KEY=<key>"
  echo "Then run: ./scripts/launch-checklist.sh $GATEWAY_URL"
else
  echo "Failed to create consumer. Response:"
  echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
