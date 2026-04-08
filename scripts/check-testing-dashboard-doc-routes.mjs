#!/usr/bin/env node
/**
 * Ensures every in-app /testing/docs/* path declared in docs-nav (and a few fixed URLs)
 * resolves to an existing +page.svelte. Also scans routes + landing for {base}/docs/* hrefs.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_ROOT = join(ROOT, "apps/dashboard/src/routes/testing/docs");
const NAV_FILE = join(ROOT, "apps/dashboard/src/lib/testing/docs-nav.ts");
const SCAN_ROOTS = [
  join(ROOT, "apps/dashboard/src/routes/testing"),
  join(ROOT, "apps/dashboard/src/lib/testing/components/site"),
];

function walkSvelteFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walkSvelteFiles(p, acc);
    else if (name.name.endsWith(".svelte")) acc.push(p);
  }
  return acc;
}

function hasDocPage(urlPath) {
  const normalized = urlPath.replace(/\/$/, "");
  if (!normalized.startsWith("/testing/docs")) return true;
  const rel = normalized.slice("/testing/docs".length).replace(/^\//, "");
  const dir = rel ? join(DOCS_ROOT, ...rel.split("/")) : DOCS_ROOT;
  return existsSync(join(dir, "+page.svelte"));
}

const pathsToCheck = new Set();

const navSrc = readFileSync(NAV_FILE, "utf8");
for (const m of navSrc.matchAll(/path:\s*"(\/docs[^"]+)"/g)) {
  pathsToCheck.add(`/testing${m[1]}`);
}

for (const p of [
  "/testing",
  "/testing/docs",
  "/testing/dashboard",
]) {
  pathsToCheck.add(p);
}

const reBase = /\{base\}(\/docs\/[a-zA-Z0-9/-]*)/g;
const reTpl = /\$\{base\}(\/docs\/[a-zA-Z0-9/-]*)/g;

for (const file of SCAN_ROOTS.flatMap((r) => walkSvelteFiles(r))) {
  const text = readFileSync(file, "utf8");
  let m;
  while ((m = reBase.exec(text)) !== null) pathsToCheck.add(`/testing${m[1]}`);
  while ((m = reTpl.exec(text)) !== null) pathsToCheck.add(`/testing${m[1]}`);
}

let errors = 0;
const sorted = [...pathsToCheck].filter((p) => p.startsWith("/testing/docs")).sort();
for (const p of sorted) {
  if (!hasDocPage(p)) {
    console.error(`[check-testing-docs-routes] Missing page for ${p} (expected +page.svelte under apps/dashboard/src/routes/testing/docs/...)`);
    errors++;
  }
}

for (const p of ["/testing", "/testing/dashboard"]) {
  const rel = p === "/testing" ? join(ROOT, "apps/dashboard/src/routes/testing/+page.svelte") : join(ROOT, "apps/dashboard/src/routes/testing/dashboard/+page.svelte");
  if (!existsSync(rel)) {
    console.error(`[check-testing-docs-routes] Missing ${rel}`);
    errors++;
  }
}

if (errors > 0) {
  process.exit(1);
}
console.log(`[check-testing-docs-routes] OK (${sorted.length} doc paths checked + /testing + /testing/dashboard)`);
