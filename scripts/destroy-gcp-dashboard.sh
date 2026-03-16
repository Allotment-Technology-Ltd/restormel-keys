#!/usr/bin/env bash
set -euo pipefail

# One-off helper to destroy the legacy GCP dashboard stack.
# This does NOT run automatically anywhere; invoke manually when you are
# confident the Vercel + Neon deployment is stable and you no longer need
# Cloud Run as a fallback.
#
# Usage:
#   ./scripts/destroy-gcp-dashboard.sh
#
# Prerequisites:
#   - Pulumi CLI installed and logged in (pulumi login)
#   - gcloud CLI authenticated with permission to destroy the resources
#   - infra/ Pulumi stack configured (e.g. stack "production" selected)

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -d "infra" ]; then
  echo "infra/ directory not found; nothing to destroy."
  exit 0
fi

cd infra

echo "Building Pulumi program (ts -> bin/index.js)..."
pnpm run build

echo "Selecting Pulumi stack 'production' (change if needed)..."
pulumi stack select production

echo "About to run 'pulumi destroy' for the legacy GCP dashboard stack."
echo "This will remove Cloud Run service 'keys-dashboard', the Artifact Registry repo,"
echo "and the dashboard service account defined in infra/index.ts (for this stack)."
echo
read -r -p "Continue with destroy? [y/N] " ans
case "$ans" in
  y|Y) ;;
  *) echo "Aborted."; exit 1 ;;
esac

pulumi destroy

