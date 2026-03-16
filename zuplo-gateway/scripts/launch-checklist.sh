#!/usr/bin/env bash
# Run launch validation checks for the Zuplo gateway (runbook §7).
# Usage: ./scripts/launch-checklist.sh [GATEWAY_URL]
#   GATEWAY_URL from Portal → Environments → main (or working-copy) → Gateway.
#   Or set GATEWAY_URL and ZUPLO_CONSUMER_KEY in zuplo-gateway/.env and run without args.

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
  exit 1
fi

# Trim trailing slash
GATEWAY_URL="${GATEWAY_URL%/}"
TEST_URL="$GATEWAY_URL/api/health"

PASS=0
FAIL=0
report() {
  if [[ "$1" == "PASS" ]]; then
    PASS=$((PASS + 1))
    echo "  PASS: $2"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL: $2"
  fi
}

echo "Launch checklist: $GATEWAY_URL"
echo ""

# 1. No API key → 401
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL")
if [[ "$HTTP" == "401" ]]; then
  report "PASS" "No Authorization header → 401"
else
  report "FAIL" "No Authorization header → expected 401, got $HTTP"
fi

# 2. Invalid key → 401
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer zpka_invalid_test_key" "$TEST_URL")
if [[ "$HTTP" == "401" ]]; then
  report "PASS" "Invalid consumer key → 401"
else
  report "FAIL" "Invalid consumer key → expected 401, got $HTTP"
fi

# 3. Valid consumer key → 200 (or 2xx)
if [[ -z "$ZUPLO_CONSUMER_KEY" ]]; then
  report "FAIL" "Valid consumer key → 200 (skip: ZUPLO_CONSUMER_KEY not set in .env)"
else
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ZUPLO_CONSUMER_KEY" "$TEST_URL")
  if [[ "$HTTP" =~ ^2 ]]; then
    report "PASS" "Valid consumer key → $HTTP"
  else
    report "FAIL" "Valid consumer key → expected 2xx, got $HTTP"
  fi
fi

echo ""
echo "---"
echo "Result: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo "Fix failures before launch. See docs/runbooks/zuplo-setup.md §7 and zuplo-launch-cli.md"
  exit 1
fi
echo "Gateway checks passed. Portal-only: enable Developer Portal, import docs/api/openapi.yaml (see zuplo-launch-cli.md § Portal-only steps)."
exit 0
