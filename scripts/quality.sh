#!/usr/bin/env bash
# Run coding-quality checks locally: dashboard typecheck + build, docs, secrets, hygiene.
# Exit 0 only if all pass. Run from repo root: pnpm run quality
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[quality] Dashboard check (svelte-check)..."
pnpm --filter dashboard run check

echo "[quality] Dashboard build..."
pnpm --filter dashboard run build

echo "[quality] Dashboard unit tests..."
pnpm --filter dashboard run test

echo "[quality] Review docs..."
bash scripts/review-docs.sh

echo "[quality] Secret check..."
bash scripts/check-secrets.sh

echo "[quality] Repo hygiene..."
bash scripts/check-repo-hygiene.sh

echo "[quality] Registry validation..."
node scripts/validate-registry.mjs

# Optional: smoke-test docs routes (catches runtime 500s e.g. undefined refs in templates)
if [ -n "${RUN_SMOKE:-}" ]; then
  echo "[quality] Smoke-testing docs routes..."
  bash scripts/smoke-dashboard-docs.sh
fi

echo "[quality] All checks passed."
