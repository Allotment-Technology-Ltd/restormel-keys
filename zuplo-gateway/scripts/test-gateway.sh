#!/usr/bin/env bash
# Test the gateway with the consumer key. Run from zuplo-gateway/ with .env present.
# Usage: ./scripts/test-gateway.sh <GATEWAY_URL>
#   GATEWAY_URL from Portal → Environments → main (or working-copy) → Gateway.
#   Or set GATEWAY_URL in .env and run: ./scripts/test-gateway.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$GATEWAY_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

GATEWAY_URL="${1:-$GATEWAY_URL}"
if [[ -z "$GATEWAY_URL" ]]; then
  echo "Error: GATEWAY_URL required. Pass as argument or set in zuplo-gateway/.env"
  echo "  Get from: Portal → Environments → main (or working-copy) → Gateway"
  echo "  Usage: ./scripts/test-gateway.sh https://restormel-keys-gateway-main-XXXX.zuplo.app"
  exit 1
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
