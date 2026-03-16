#!/usr/bin/env bash
# Complete Zuplo gateway setup from CLI: set env vars in Zuplo, then deploy.
#
# Prerequisites:
#   - ZUPLO_API_KEY (required): Portal → Settings → API Keys
#   - KEYS_BACKEND_URL (required): e.g. https://keys-dashboard-XXX.run.app/keys/dashboard (no trailing slash)
#   - KEYS_BACKEND_API_KEY (required for backend auth): backend key sk-rk-...; set in Zuplo as secret
#   - Optional: ZUPLO_ACCOUNT_NAME, ZUPLO_PROJECT_NAME, ZUPLO_BRANCH (default main)
#
# Usage:
#   cd zuplo-gateway && ./scripts/setup-from-cli.sh
#   Or with env from file: set -a && source .env && set +a && ./scripts/setup-from-cli.sh
#
# After running: create a consumer (Portal or scripts/create-consumer-and-test.sh), then test with scripts/test-gateway.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$GATEWAY_DIR/.env"

# Load .env if present (do not commit secrets; .env is gitignored)
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

PROJECT_NAME="${ZUPLO_PROJECT_NAME:-restormel-keys-gateway}"
BRANCH="${ZUPLO_BRANCH:-main}"

cd "$GATEWAY_DIR"

for var in ZUPLO_API_KEY KEYS_BACKEND_URL KEYS_BACKEND_API_KEY; do
  if [[ -z "${!var}" ]]; then
    echo "Error: $var is required. Set it in your environment or zuplo-gateway/.env"
    echo "  ZUPLO_API_KEY: Zuplo Portal → Settings → API Keys"
    echo "  KEYS_BACKEND_URL: Cloud Run URL + /keys/dashboard (from: cd infra && pulumi stack output dashboardServiceUrl)"
    echo "  KEYS_BACKEND_API_KEY: Backend key (sk-rk-...) for Authorization header to Cloud Run"
    exit 1
  fi
done

# Optional account/project for CLI (if not linked via zuplo link)
VAR_OPTS=()
[[ -n "$ZUPLO_ACCOUNT_NAME" ]] && VAR_OPTS+=(--account "$ZUPLO_ACCOUNT_NAME")
[[ -n "$ZUPLO_PROJECT_NAME" ]] && VAR_OPTS+=(--project "$ZUPLO_PROJECT_NAME")

DEPLOY_OPTS=(--project "$PROJECT_NAME" --environment "$BRANCH" --no-verify-remote)
[[ -n "$ZUPLO_ACCOUNT_NAME" ]] && DEPLOY_OPTS+=(--account "$ZUPLO_ACCOUNT_NAME")

echo "Setting Zuplo environment variables (branch: $BRANCH)..."

set_var() {
  local name="$1"
  local value="$2"
  local is_secret="${3:-false}"
  if pnpm exec zuplo variable update --name "$name" --value "$value" --branch "$BRANCH" "${VAR_OPTS[@]}" --api-key "$ZUPLO_API_KEY" 2>/dev/null; then
    echo "  Updated $name"
  else
    pnpm exec zuplo variable create --name "$name" --value "$value" --is-secret "$is_secret" --branch "$BRANCH" "${VAR_OPTS[@]}" --api-key "$ZUPLO_API_KEY"
    echo "  Created $name"
  fi
}

set_var "KEYS_BACKEND_URL" "$KEYS_BACKEND_URL" "false"
set_var "KEYS_BACKEND_API_KEY" "$KEYS_BACKEND_API_KEY" "true"

echo ""
echo "Deploying gateway (project: $PROJECT_NAME, environment: $BRANCH)..."
pnpm exec zuplo deploy "${DEPLOY_OPTS[@]}" --api-key "$ZUPLO_API_KEY"

echo ""
echo "Done. Next steps:"
echo "  1. Gateway URL: get from Portal → Environments → $BRANCH → Gateway (no CLI output)."
echo "  2. Create an API key consumer (Portal → API Key Service, or ./scripts/create-consumer-and-test.sh with GATEWAY_URL, ZUPLO_ACCOUNT_NAME, ZUPLO_BUCKET_NAME)."
echo "  3. Put the consumer key in zuplo-gateway/.env as ZUPLO_CONSUMER_KEY."
echo "  4. Run validation: ./scripts/launch-checklist.sh <GATEWAY_URL>"
echo "     Or test once: ./scripts/test-gateway.sh <GATEWAY_URL>"
