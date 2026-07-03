#!/usr/bin/env bash
# Phase 7 gate: smoke a minimal consumer that uses only @restormel/keys-elements and
# @restormel/graph-elements (not keys/svelte/react or ui-graph-svelte).
# Run from repo root. Exit 1 on failure.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[smoke-elements] Building keys-elements + graph-elements..."
pnpm --filter @restormel/keys-elements run build
pnpm --filter @restormel/graph-elements run build
pnpm --filter @restormel/keys-elements test
pnpm --filter @restormel/graph-elements test

SMOKE_DIR="$(mktemp -d)"
trap 'rm -rf "$SMOKE_DIR"' EXIT

cat > "$SMOKE_DIR/package.json" <<JSON
{
  "name": "restormel-elements-only-smoke",
  "private": true,
  "type": "module",
  "dependencies": {
    "@restormel/keys-elements": "file:${ROOT}/packages/elements",
    "@restormel/graph-elements": "file:${ROOT}/packages/graph-elements"
  }
}
JSON

echo "[smoke-elements] Installing temp consumer..."
(cd "$SMOKE_DIR" && npm install --omit=dev --no-audit --no-fund 2>&1 | tail -5)

FORBIDDEN=(
  "@restormel/keys-svelte"
  "@restormel/keys-react"
  "@restormel/ui-graph-svelte"
)

for pkg in "${FORBIDDEN[@]}"; do
  if [ -d "$SMOKE_DIR/node_modules/$pkg" ]; then
    echo "[smoke-elements] FAIL forbidden dependency installed: $pkg"
    exit 1
  fi
done

SMOKE_DIR="$SMOKE_DIR" node <<'NODER'
const fs = require("fs");
const path = require("path");
const root = process.env.SMOKE_DIR;
for (const pkg of ["@restormel/keys-elements", "@restormel/graph-elements"]) {
  const pkgJson = path.join(root, "node_modules", pkg, "package.json");
  if (!fs.existsSync(pkgJson)) {
    console.error("[smoke-elements] FAIL missing", pkg);
    process.exit(1);
  }
  const main = JSON.parse(fs.readFileSync(pkgJson, "utf8")).main;
  const mainPath = path.join(root, "node_modules", pkg, main || "dist/index.js");
  if (!fs.existsSync(mainPath)) {
    console.error("[smoke-elements] FAIL missing main for", pkg, mainPath);
    process.exit(1);
  }
  console.log("[smoke-elements] OK", pkg, "main", main);
}
NODER

echo "[smoke-elements] OK — elements-only consumer smoke passed"
