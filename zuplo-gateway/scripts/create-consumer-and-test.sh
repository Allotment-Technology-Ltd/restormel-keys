#!/usr/bin/env bash
# Create a Zuplo API key consumer and test the gateway from CLI.
#
# Prerequisites:
#   - ZUPLO_API_KEY: Your Zuplo Developer API key (Portal → Settings → API Keys)
#   - ZUPLO_ACCOUNT_NAME: Your account name (from portal URL, e.g. silver_profitable_wasp)
#   - ZUPLO_BUCKET_NAME: Key bucket for the project (Portal → Project → Settings → Project Information)
#   - GATEWAY_URL: Gateway URL to test (e.g. https://restormel-keys-gateway-main-0a9c221.d2.zuplo.dev)
#
# Usage:
#   ZUPLO_API_KEY=zpka_xxx ZUPLO_ACCOUNT_NAME=my-account ZUPLO_BUCKET_NAME=my-bucket GATEWAY_URL=https://... ./scripts/create-consumer-and-test.sh

set -e

CONSUMER_NAME="${ZUPLO_CONSUMER_NAME:-test-consumer-cli}"
API_BASE="https://dev.zuplo.com/v1"

for var in ZUPLO_API_KEY ZUPLO_ACCOUNT_NAME ZUPLO_BUCKET_NAME GATEWAY_URL; do
  if [[ -z "${!var}" ]]; then
    echo "Error: $var is required. Set it in your environment."
    echo "  ZUPLO_ACCOUNT_NAME: from portal URL (e.g. portal.zuplo.com/ACCOUNT/PROJECT)"
    echo "  ZUPLO_BUCKET_NAME: Portal → Project → Settings → Project Information"
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
  echo "To use this key: export ZUPLO_CONSUMER_KEY=$API_KEY"
else
  echo "Failed to create consumer. Response:"
  echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
