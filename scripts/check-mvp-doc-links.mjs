#!/usr/bin/env node
/**
 * Assert Keys MVP surfaces do not promote deprecated npm install targets.
 * Run from repo root: node scripts/check-mvp-doc-links.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  "apps/dashboard/src/lib/keys/docs-nav.ts",
  "apps/dashboard/src/lib/server/module-gates.ts",
  "apps/dashboard/src/routes/sitemap.xml/+server.ts",
  "apps/dashboard/src/lib/public-npm-packages.ts",
  "apps/dashboard/src/routes/keys/+page.svelte",
  "apps/dashboard/src/routes/keys/docs/compatibility/+page.svelte",
  "apps/dashboard/src/routes/integrations/+page.svelte",
  "apps/dashboard/src/routes/keys/docs/walkthrough/phase-1-install/+page.svelte",
  "README.md",
  "docs/reference/npm-packages.md",
];

const deprecatedInstallPatterns = [
  /pnpm add @restormel\/keys["'\s]/,
  /pnpm add @restormel\/keys @restormel\/keys-react/,
  /pnpm add @restormel\/keys @restormel\/keys-svelte/,
  /npm install @restormel\/keys/,
  /pnpm add @restormel\/graph-core @restormel\/ui-graph-svelte/,
];

let failed = false;

function fail(msg) {
  console.error(`[check-mvp-doc-links] ${msg}`);
  failed = true;
}

for (const rel of files) {
  const path = join(root, rel);
  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    fail(`missing file: ${rel}`);
    continue;
  }

  for (const pattern of deprecatedInstallPatterns) {
    if (pattern.test(source)) {
      fail(`${rel} promotes deprecated npm install: ${pattern}`);
    }
  }
}

const navSource = readFileSync(join(root, "apps/dashboard/src/lib/keys/docs-nav.ts"), "utf8");
if (!navSource.includes("keysDocsNavBlocksForFlags")) {
  fail("keys/docs-nav.ts missing keysDocsNavBlocksForFlags()");
}

const sitemapSource = readFileSync(
  join(root, "apps/dashboard/src/routes/sitemap.xml/+server.ts"),
  "utf8",
);
if (!sitemapSource.includes("resolveModuleFlagsSync")) {
  fail("sitemap.xml/+server.ts must filter paths via resolveModuleFlagsSync()");
}

if (failed) {
  process.exit(1);
}

console.log("[check-mvp-doc-links] OK — MVP doc gates and npm install hygiene");
