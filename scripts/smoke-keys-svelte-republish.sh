#!/usr/bin/env bash
# Pack @restormel/keys + @restormel/keys-svelte, install into a copy of demo-svelte from tarballs,
# verify package.json export paths exist on disk, then run production build (simulates npm consumer).
# Run from repo root. Exit 1 on failure.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[smoke-svelte] Building core + keys-svelte..."
pnpm --filter @restormel/keys run build
pnpm --filter @restormel/keys-svelte run build

echo "[smoke-svelte] Verifying export targets exist on disk..."
node <<'NODER'
const fs = require("fs");
const path = require("path");
const pkgPath = path.join(process.cwd(), "packages/svelte/package.json");
const p = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const ex = p.exports || {};
const paths = [];
for (const k of Object.keys(ex)) {
  const v = ex[k];
  if (typeof v === "string") paths.push(v);
  else if (v && typeof v === "object")
    for (const x of Object.values(v))
      if (typeof x === "string" && x.startsWith("./dist/")) paths.push(x);
}
for (const rel of paths) {
  const f = path.join(process.cwd(), "packages/svelte", rel.slice(2));
  if (!fs.existsSync(f)) {
    console.error("[smoke-svelte] FAIL missing export file:", rel, "->", f);
    process.exit(1);
  }
  console.log("[smoke-svelte] OK export file:", rel);
}
NODER

PACK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/rk-svelte-pack-XXXXXX")"
DEMO_TMP="$(mktemp -d "${TMPDIR:-/tmp}/rk-demo-svelte-smoke-XXXXXX")"
trap 'rm -rf "$PACK_DIR" "$DEMO_TMP"' EXIT

echo "[smoke-svelte] Packing to $PACK_DIR ..."
( cd "$ROOT/packages/core" && pnpm pack --pack-destination "$PACK_DIR" )
( cd "$ROOT/packages/svelte" && pnpm pack --pack-destination "$PACK_DIR" )

KEYS_TGZ="$(ls -1 "$PACK_DIR"/restormel-keys-*.tgz | head -1)"
SV_TGZ="$(ls -1 "$PACK_DIR"/restormel-keys-svelte-*.tgz | head -1)"
if [ ! -f "$KEYS_TGZ" ] || [ ! -f "$SV_TGZ" ]; then
  echo "[smoke-svelte] FAIL tarball not found"
  ls -la "$PACK_DIR"
  exit 1
fi

echo "[smoke-svelte] Verifying tarball contains dist artifacts..."
# Extract instead of `tar -tzf | grep`: listing to a pipe/file can hit "tar: stdout: write error"
# in some CI environments (pipe closure, /tmp pressure). Extraction is deterministic.
SV_EXTRACT="$PACK_DIR/sv-tarball-extract"
rm -rf "$SV_EXTRACT"
mkdir -p "$SV_EXTRACT"
tar -xzf "$SV_TGZ" -C "$SV_EXTRACT"
for rel in "package/dist/index.js" "package/dist/index.d.ts" "package/dist/keys-svelte.css"; do
  if [ ! -f "$SV_EXTRACT/$rel" ]; then
    echo "[smoke-svelte] FAIL missing in tarball: $rel"
    find "$SV_EXTRACT" -type f 2>/dev/null | head -30 || true
    exit 1
  fi
done

echo "[smoke-svelte] Copying demo-svelte -> $DEMO_TMP ..."
cp -R "$ROOT/apps/demo-svelte/." "$DEMO_TMP/"
rm -f "$DEMO_TMP/pnpm-lock.yaml"

node <<NODER
const fs = require("fs");
const path = require("path");
const demo = path.join("$DEMO_TMP", "package.json");
const j = JSON.parse(fs.readFileSync(demo, "utf8"));
j.dependencies = j.dependencies || {};
j.dependencies["@restormel/keys"] = "file:$KEYS_TGZ";
j.dependencies["@restormel/keys-svelte"] = "file:$SV_TGZ";
fs.writeFileSync(demo, JSON.stringify(j, null, 2) + "\n");
NODER

echo "[smoke-svelte] Installing demo-svelte from tarballs (pnpm, ignore workspace root)..."
cd "$DEMO_TMP"
pnpm install --no-frozen-lockfile --ignore-workspace

echo "[smoke-svelte] Production build demo-svelte..."
pnpm run build

echo "[smoke-svelte] OK — tarball consumer build succeeded."
