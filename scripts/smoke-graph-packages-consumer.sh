#!/usr/bin/env bash
# Pack @restormel/graph-core + @restormel/ui-graph-svelte, install into a copy of restormel-graph-demo
# from tarballs, verify export files exist, then run svelte-check + production build (simulates npm consumer).
# Run from repo root. Exit 1 on failure.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[smoke-graph] Building graph-core + ui-graph-svelte..."
pnpm --filter @restormel/graph-core run build
pnpm --filter @restormel/ui-graph-svelte run build
pnpm --filter @restormel/graph-core test

echo "[smoke-graph] Verifying graph-core export targets exist on disk..."
node <<'NODER'
const fs = require("fs");
const path = require("path");
const pkgPath = path.join(process.cwd(), "packages/graph-core/package.json");
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
  const f = path.join(process.cwd(), "packages/graph-core", rel.slice(2));
  if (!fs.existsSync(f)) {
    console.error("[smoke-graph] FAIL missing export file:", rel, "->", f);
    process.exit(1);
  }
  console.log("[smoke-graph] OK export file:", rel);
}
NODER

echo "[smoke-graph] Verifying ui-graph-svelte export targets exist on disk..."
node <<'NODER'
const fs = require("fs");
const path = require("path");
const pkgPath = path.join(process.cwd(), "packages/ui-graph-svelte/package.json");
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
  const f = path.join(process.cwd(), "packages/ui-graph-svelte", rel.slice(2));
  if (!fs.existsSync(f)) {
    console.error("[smoke-graph] FAIL missing export file:", rel, "->", f);
    process.exit(1);
  }
  console.log("[smoke-graph] OK export file:", rel);
}
NODER

PACK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/rk-graph-pack-XXXXXX")"
DEMO_TMP="$(mktemp -d "${TMPDIR:-/tmp}/rk-graph-demo-smoke-XXXXXX")"
trap 'rm -rf "$PACK_DIR" "$DEMO_TMP"' EXIT

echo "[smoke-graph] Packing to $PACK_DIR ..."
( cd "$ROOT/packages/graph-core" && pnpm pack --pack-destination "$PACK_DIR" )
( cd "$ROOT/packages/ui-graph-svelte" && pnpm pack --pack-destination "$PACK_DIR" )

GC_TGZ="$(ls -1 "$PACK_DIR"/restormel-graph-core-*.tgz | head -1)"
UI_TGZ="$(ls -1 "$PACK_DIR"/restormel-ui-graph-svelte-*.tgz | head -1)"
if [ ! -f "$GC_TGZ" ] || [ ! -f "$UI_TGZ" ]; then
  echo "[smoke-graph] FAIL tarball not found"
  ls -la "$PACK_DIR"
  exit 1
fi

echo "[smoke-graph] Verifying ui-graph-svelte tarball contains dist..."
UI_EXTRACT="$PACK_DIR/ui-tarball-extract"
rm -rf "$UI_EXTRACT"
mkdir -p "$UI_EXTRACT"
UI_TGZ="$UI_TGZ" UI_EXTRACT="$UI_EXTRACT" python3 <<'PY'
import os, sys, tarfile
ui = os.environ["UI_TGZ"]
out = os.environ["UI_EXTRACT"]
os.makedirs(out, exist_ok=True)
with tarfile.open(ui, "r:gz") as tf:
    try:
        tf.extractall(out, filter="data")
    except TypeError:
        tf.extractall(out)
for rel in ("package/dist/index.js", "package/dist/index.d.ts"):
    path = os.path.join(out, rel)
    if not os.path.isfile(path):
        print("[smoke-graph] FAIL missing in tarball:", rel, file=sys.stderr)
        sys.exit(1)
PY

echo "[smoke-graph] Copying restormel-graph-demo -> $DEMO_TMP ..."
cp -R "$ROOT/apps/restormel-graph-demo/." "$DEMO_TMP/"
rm -f "$DEMO_TMP/pnpm-lock.yaml"

GC_TGZ="$GC_TGZ" UI_TGZ="$UI_TGZ" DEMO_TMP="$DEMO_TMP" node <<'NODER'
const fs = require("fs");
const path = require("path");
const demo = path.join(process.env.DEMO_TMP, "package.json");
const j = JSON.parse(fs.readFileSync(demo, "utf8"));
j.dependencies = j.dependencies || {};
j.dependencies["@restormel/graph-core"] = "file:" + process.env.GC_TGZ;
j.dependencies["@restormel/ui-graph-svelte"] = "file:" + process.env.UI_TGZ;
j.pnpm = j.pnpm || {};
j.pnpm.overrides = Object.assign({}, j.pnpm.overrides, {
  "@restormel/graph-core": "file:" + process.env.GC_TGZ,
});
delete j.scripts.prebuild;
fs.writeFileSync(demo, JSON.stringify(j, null, 2) + "\n");
NODER

echo "[smoke-graph] Installing restormel-graph-demo from tarballs (pnpm, ignore workspace root)..."
cd "$DEMO_TMP"
pnpm install --no-frozen-lockfile --ignore-workspace

echo "[smoke-graph] svelte-check + production build..."
pnpm run check
pnpm run build

echo "[smoke-graph] OK — tarball consumer check + build succeeded."
