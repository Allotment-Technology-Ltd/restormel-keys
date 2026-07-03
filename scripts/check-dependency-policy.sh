#!/usr/bin/env bash
# Check package manifests exist and are valid (Phase 00: root package.json + pnpm workspace).
# Exit 0 if OK; exit 1 with actionable message. Aligns to docs/bootstrap-plan.md.
# Requires: bash. Optional: node (for JSON validation of package.json).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MISSING=0

if [ ! -f "$ROOT/package.json" ]; then
  echo "Missing: package.json — add at repo root (see docs/bootstrap-plan.md)."
  MISSING=1
fi

if [ ! -f "$ROOT/pnpm-workspace.yaml" ]; then
  echo "Missing: pnpm-workspace.yaml — add at repo root (see docs/bootstrap-plan.md)."
  MISSING=1
fi

# Validate package.json if node is available
if [ -f "$ROOT/package.json" ]; then
  if command -v node >/dev/null 2>&1; then
    if ! node -e "JSON.parse(require('fs').readFileSync('$ROOT/package.json', 'utf8'))" 2>/dev/null; then
      echo "Invalid package.json — fix JSON syntax (e.g. run: node -e \"require('$ROOT/package.json')\")."
      MISSING=1
    fi
  fi
fi

if [ "$MISSING" -eq 0 ]; then
  echo "Dependency policy check OK"
  exit 0
else
  echo "Fix the items above, then re-run this script."
  exit 1
fi
