#!/usr/bin/env node
/**
 * Ensures every /graph/docs/* path declared in graph docs-nav resolves to +page.svelte.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_ROOT = join(ROOT, "apps/dashboard/src/routes/graph/docs");
const NAV_FILE = join(ROOT, "apps/dashboard/src/lib/graph/docs-nav.ts");
const SCAN_ROOTS = [
  join(ROOT, "apps/dashboard/src/routes/graph"),
  join(ROOT, "apps/dashboard/src/lib/graph"),
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
  if (!normalized.startsWith("/graph/docs")) return true;
  const rel = normalized.slice("/graph/docs".length).replace(/^\//, "");
  const dir = rel ? join(DOCS_ROOT, ...rel.split("/")) : DOCS_ROOT;
  return existsSync(join(dir, "+page.svelte"));
}

const pathsToCheck = new Set();

const navSrc = readFileSync(NAV_FILE, "utf8");
for (const m of navSrc.matchAll(/path:\s*"(\/docs[^"]+)"/g)) {
  pathsToCheck.add(`/graph${m[1]}`);
}

for (const p of ["/graph", "/graph/docs"]) {
  pathsToCheck.add(p);
}

const reBase = /\{base\}(\/docs\/[a-zA-Z0-9/-]*)/g;
const reTpl = /\$\{base\}(\/docs\/[a-zA-Z0-9/-]*)/g;

for (const file of SCAN_ROOTS.flatMap((r) => walkSvelteFiles(r))) {
  const text = readFileSync(file, "utf8");
  let m;
  while ((m = reBase.exec(text)) !== null) pathsToCheck.add(`/graph${m[1]}`);
  while ((m = reTpl.exec(text)) !== null) pathsToCheck.add(`/graph${m[1]}`);
}

let errors = 0;
const sorted = [...pathsToCheck].filter((p) => p.startsWith("/graph/docs")).sort();
for (const p of sorted) {
  if (!hasDocPage(p)) {
    console.error(
      `[check-graph-docs-routes] Missing page for ${p} (expected +page.svelte under apps/dashboard/src/routes/graph/docs/...)`,
    );
    errors++;
  }
}

for (const p of ["/graph"]) {
  const rel = join(ROOT, "apps/dashboard/src/routes/graph/+page.svelte");
  if (!existsSync(rel)) {
    console.error(`[check-graph-docs-routes] Missing ${rel}`);
    errors++;
  }
}

if (errors > 0) {
  process.exit(1);
}
console.log(`[check-graph-docs-routes] OK (${sorted.length} doc paths checked + /graph)`);
