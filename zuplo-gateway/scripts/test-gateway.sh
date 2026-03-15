#!/usr/bin/env bash
# Test the gateway with the consumer key. Run from zuplo-gateway/ with .env present.
# Usage: ./scripts/test-gateway.sh [gateway_url]

set -e

GATEWAY_URL="${1:-https://restormel-keys-gateway-main-bc13eba.zuplo.app}"
ENV_FILE="$(dirname "$0")/../.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [[ -z "$ZUPLO_CONSUMER_KEY" ]]; then
  echo "Error: ZUPLO_CONSUMER_KEY is not set. Add it to zuplo-gateway/.env or export it."
  echo "  Example .env: ZUPLO_CONSUMER_KEY=zpka_your_key_here"
  exit 1
fi

echo "Testing: $GATEWAY_URL/api/health"
echo "Key prefix: ${ZUPLO_CONSUMER_KEY:0:20}..."
echo ""

HTTP_CODE=$(curl -s -o /tmp/zuplo-test-body.txt -w "%{http_code}" \
  -H "Authorization: Bearer $ZUPLO_CONSUMER_KEY" \
  "$GATEWAY_URL/api/health")

echo "HTTP status: $HTTP_CODE"
echo "Response body:"
cat /tmp/zuplo-test-body.txt
echo ""

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "OK: Gateway and backend returned 200."
elif [[ "$HTTP_CODE" == "401" ]]; then
  echo "401: Auth failed. Check that ZUPLO_CONSUMER_KEY in .env is the consumer key (from API Key Service), not the account key."
elif [[ "$HTTP_CODE" == "404" ]]; then
  echo "404: Backend returned Not Found. Check KEYS_BACKEND_URL in Zuplo (Settings → Environment Variables) and that the backend serves /api/health."
else
  echo "Unexpected status. Check Zuplo logs and backend."
fi
