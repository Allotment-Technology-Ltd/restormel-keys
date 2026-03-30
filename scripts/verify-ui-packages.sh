#!/usr/bin/env bash
# Verify that keys-elements and keys-react build cleanly and produce expected outputs.
# Run before tagging a release that includes these packages.
set -euo pipefail

echo "=== Building dependency chain ==="
pnpm --filter @restormel/keys run build
pnpm --filter @restormel/keys-svelte run build

echo ""
echo "=== @restormel/keys-elements ==="
pnpm --filter @restormel/keys-elements run build
if [[ ! -f packages/elements/dist/index.js ]]; then
  echo "FAIL: packages/elements/dist/index.js not found"
  exit 1
fi
echo "  ✓ dist/index.js exists"

if [[ ! -f packages/elements/dist/index.d.ts ]]; then
  echo "FAIL: packages/elements/dist/index.d.ts not found"
  exit 1
fi
echo "  ✓ dist/index.d.ts exists"

pnpm --filter @restormel/keys-elements test
echo "  ✓ tests pass"

echo ""
echo "=== @restormel/keys-react ==="
pnpm --filter @restormel/keys-react run build
if [[ ! -f packages/react/dist/index.js ]]; then
  echo "FAIL: packages/react/dist/index.js not found"
  exit 1
fi
echo "  ✓ dist/index.js exists"

if [[ ! -f packages/react/dist/index.d.ts ]]; then
  echo "FAIL: packages/react/dist/index.d.ts not found"
  exit 1
fi
echo "  ✓ dist/index.d.ts exists"

pnpm --filter @restormel/keys-react test
echo "  ✓ tests pass"

echo ""
echo "=== Pack dry-run (verify publishable contents) ==="
cd packages/elements
ELEMENTS_TARBALL=$(pnpm pack --dry-run 2>&1 | grep -E '\.tgz$' || true)
echo "  elements would pack: ${ELEMENTS_TARBALL:-<check output above>}"
cd ../react
REACT_TARBALL=$(pnpm pack --dry-run 2>&1 | grep -E '\.tgz$' || true)
echo "  react would pack: ${REACT_TARBALL:-<check output above>}"
cd ../..

echo ""
echo "=== Verify package.json exports ==="
node -e "
  const el = require('./packages/elements/package.json');
  const rc = require('./packages/react/package.json');
  const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };
  assert(el.name === '@restormel/keys-elements', 'elements name');
  assert(el.files && el.files.includes('dist'), 'elements files includes dist');
  assert(el.exports['.'], 'elements exports . entry');
  assert(rc.name === '@restormel/keys-react', 'react name');
  assert(rc.files && rc.files.includes('dist'), 'react files includes dist');
  assert(rc.exports['.'], 'react exports . entry');
  assert(rc.peerDependencies && rc.peerDependencies.react, 'react peer dep');
  console.log('  ✓ package.json exports valid');
"

echo ""
echo "=== All checks passed ==="
echo ""
echo "Next steps:"
echo "  1. Ensure NPM_TOKEN has permission to create new @restormel/* packages"
echo "  2. Commit these changes to main"
echo "  3. Option A: Run standalone workflows (Publish keys-elements, then Publish keys-react) via GitHub Actions"
echo "  4. Option B: Tag a full release: git tag keys-v<next> && git push origin keys-v<next>"
echo "  5. Verify: npm view @restormel/keys-elements version && npm view @restormel/keys-react version"
