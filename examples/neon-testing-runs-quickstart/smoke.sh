#!/usr/bin/env bash
# Smoke-test the running server: prove the Neon-backed store answers /health and /v1/runs.
set -euo pipefail

BASE="http://127.0.0.1:${RESTORMEL_RUNS_PORT:-8787}"
auth=()
if [ -n "${RESTORMEL_RUNS_API_TOKEN:-}" ]; then
  auth=(-H "Authorization: Bearer ${RESTORMEL_RUNS_API_TOKEN}")
fi

echo '== GET /health  (expect "store":"neon","db":"ok" when pointed at Neon) =='
curl -fsS "${auth[@]}" "$BASE/health"; echo

echo '== GET /v1/runs  (durable run history from Neon — empty list on a fresh branch) =='
curl -fsS "${auth[@]}" "$BASE/v1/runs"; echo
