#!/usr/bin/env bash
# Smoke-test key docs routes after dashboard build: start preview, GET URLs, expect 200.
# Run from repo root after: pnpm --filter dashboard run build
# Exit 0 if all URLs return 2xx; exit 1 on 5xx or unreachable.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PREVIEW_PORT="${PREVIEW_PORT:-4173}"
BASE="http://localhost:${PREVIEW_PORT}"

# Build if needed so preview has something to serve
if [ ! -d "apps/dashboard/.svelte-kit/output" ]; then
  echo "[smoke] Building dashboard..."
  pnpm --filter dashboard run build
fi

echo "[smoke] Starting dashboard preview on port ${PREVIEW_PORT}..."
(cd apps/dashboard && pnpm exec vite preview --port "${PREVIEW_PORT}" --strictPort) &
PREV_PID=$!
trap 'kill $PREV_PID 2>/dev/null || true' EXIT

# Wait for server to respond (retry a few times)
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" "${BASE}/keys/docs" 2>/dev/null | grep -q '^[23]'; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "[smoke] Preview did not become ready in time."
    exit 1
  fi
  sleep 1
done

FAILED=0
# Marketing homepage (SSR); curl smoke catches 5xx that docs-only lists would miss.
for path in "/" "/pricing" "/founders" "/changelog" "/keys/pricing" "/keys/docs" "/keys/docs/guides/keys-testing-onboarding" "/keys/docs/walkthrough/phase-0-inventory" \
  "/keys/docs/walkthrough/phase-2-resolve" "/keys/docs/walkthrough/phase-3-routes" \
  "/testing" "/testing/docs" "/testing/docs/guides/plot-dogfooding" \
  "/testing/docs/guides/ci" "/testing/docs/architecture" "/testing/docs/compatibility" \
  "/testing/docs/guides/ci-security" "/testing/docs/guides/http-runs-and-actions" \
  "/testing/docs/guides/performance-goals" "/testing/docs/getting-started/existing-stack" \
  "/testing/docs/guides/keys-ci-checklist" \
  "/testing/docs/guides/keys-dashboard-onboarding"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}${path}" 2>/dev/null || echo "000")
  if [ "$CODE" = "000" ] || [ "${CODE#5}" != "$CODE" ]; then
    echo "[smoke] FAIL ${path} → ${CODE}"
    FAILED=1
  else
    echo "[smoke] OK   ${path} → ${CODE}"
  fi
done

[ "$FAILED" -eq 0 ] || exit 1
echo "[smoke] All docs routes returned 2xx."
