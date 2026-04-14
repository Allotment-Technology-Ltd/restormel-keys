#!/usr/bin/env bash
# Lightweight routing doc / contract string checks. Extend when adding new contract surfaces.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

missing=0
for needle in "2026-04-14" "stepChain" "routingAttempts" "explain-chain" "route-graph-bundle.schema.json"; do
  if ! grep -Rq "$needle" docs/keys-routing-contract.md docs/api/openapi.yaml 2>/dev/null; then
    echo "[routing-doc-drift] expected reference '$needle' not found in keys-routing-contract or openapi"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "[routing-doc-drift] OK"
