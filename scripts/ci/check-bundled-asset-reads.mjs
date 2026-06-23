#!/usr/bin/env node
/**
 * CI GUARD — bundled adapter-node `import.meta.url` asset-path overshoot.
 *
 * Systemic guard for RISK-014 / REC-INC-008. See the canonical pattern doc:
 *   docs/engineering/server-data-assets.md
 *
 * ── The bug class (3 prod instances + a risk entry) ──────────────────────────
 * A server module under apps/dashboard/src/lib/server/ resolves a SHIPPED, NON-CODE
 * data asset (seed JSON, starter-corpus markdown, governance records/YAML) via a path
 * that is FIXED relative to `import.meta.url`:
 *
 *   (a) a fixed up-tree climb:   new URL("../../../../data/x.json", import.meta.url)
 *                                join(dirname(fileURLToPath(import.meta.url)), "../../../x")
 *   (b) a sibling-dir read:      join(dirname(fileURLToPath(import.meta.url)), "starter-corpus")
 *
 * …then `readFileSync` / `readdirSync` that path at runtime.
 *
 * This is correct in the source tree, in dev/CI, and under SvelteKit prerender — but the
 * bundled **adapter-node prod runtime** emits the importing module at a DIFFERENT depth, so
 * (a) overshoots (the `dashboard/` segment drops → `/app/apps/data/...`) and (b) points at a
 * sibling dir the build never copies. The read throws ENOENT → bare HTTP 500, invisible
 * everywhere except the bundled prod build. Known instances:
 *   1. 112b8c99 — records gate REPO_ROOT  (fixed: resolveRepoRoot cwd-walk)
 *   2. PR #276  — Connect starter-corpus   (fixed: module-import + Vite ?raw)
 *   3. PR #282  — model-catalog-seed.json  (fixed: shared resolveSeedPath cwd-walk)
 *
 * ── What this guard enforces (the canonical pattern) ─────────────────────────
 * A NEW server-read raw data asset MUST use one of two sanctioned patterns:
 *   PREFERRED  — module-import:  `import x from "./x.json"` (JSON) / Vite `?raw` (text).
 *                Rollup inlines it into the server chunk. No runtime fs. Adapter-agnostic.
 *   FALLBACK   — shared cwd-walk resolver (resolveRepoRoot / resolveSeedPath) when the asset
 *                set is dynamic / whole-repo / git-backed and cannot be module-imported.
 * A bare `../`-climb (or sibling-dir read) relative to `import.meta.url` feeding a runtime
 * fs read is FORBIDDEN — it is the exact shape of the bug.
 *
 * The guard fails CI on any NEW such site. Already-known sites are listed in ALLOWLIST below
 * (each with a tracking reference); the guard is green on current main and STAYS green after
 * the open fix PRs merge — their fixes remove the forbidden shape, and a stale allowlist entry
 * is reported (not failed) so it gets cleaned up. To clear a NEW failure, adopt a sanctioned
 * pattern (do NOT just add to the allowlist).
 *
 * Dependency-free — plain `node`. Exit 1 on any un-allowlisted violation.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_ROOT = join(ROOT, "apps/dashboard/src/lib/server");
const SELF = "scripts/ci/check-bundled-asset-reads.mjs";
const DOC = "docs/engineering/server-data-assets.md";

/**
 * Known sites that still carry the forbidden shape on current main, each pending a
 * sanctioned fix. The guard does NOT fail on these — but it DOES report any entry that no
 * longer matches (so a merged fix prompts allowlist cleanup). Adding a NEW entry here to
 * silence a fresh violation is a review red-flag: fix the site instead (see DOC).
 *
 * `path` is repo-relative. `reason` must name the tracking ref (PR/incident/risk).
 */
const ALLOWLIST = [
  {
    path: "apps/dashboard/src/lib/server/catalogue/seed-repository.ts",
    reason: "Fixed by PR #282 (resolveSeedPath cwd-walk). Remove this entry once #282 merges.",
  },
  {
    path: "apps/dashboard/src/lib/server/connect/model-catalog-sync.ts",
    reason: "Fixed by PR #282 (resolveSeedPath cwd-walk). Remove this entry once #282 merges.",
  },
  {
    path: "apps/dashboard/src/lib/server/connect/starter-corpus.ts",
    reason: "Fixed by PR #276 (module-import + Vite ?raw). Remove this entry once #276 merges.",
  },
  {
    path: "apps/dashboard/src/lib/server/records/subprocessors.ts",
    reason:
      "Latent same-class instance (RISK-014): reads governance/suppliers.yaml via a fixed " +
      "../../../../../.. climb. Tracked for a follow-up resolveRepoRoot adoption — fix, then remove.",
  },
  {
    path: "apps/dashboard/src/lib/server/connect/demo-graph/seed-demo-graph.ts",
    reason:
      "Latent same-class instance (RISK-014): readdir/readFile of sibling *.json next to the " +
      "module (dirname(import.meta.url)) — the dir is not copied into the adapter-node bundle. " +
      "Tracked for a follow-up module-import adoption — fix, then remove.",
  },
];
const ALLOWED = new Set(ALLOWLIST.map((e) => e.path));

/** A site is SANCTIONED (never flagged) when it routes through a cwd-walk resolver. */
const RESOLVER_MARKERS = [
  "resolveRepoRoot",
  "resolveSeedPath",
  // A bespoke cwd-walk: walks process.cwd() up to the workspace marker. This is the
  // generic shape of the sanctioned fallback, so a hand-rolled resolver also passes.
  "pnpm-workspace.yaml",
];

/** Recursively collect server .ts files, skipping tests and type decls. */
function collect(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const fp = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      collect(fp, acc);
    } else if (
      e.isFile() &&
      e.name.endsWith(".ts") &&
      !e.name.endsWith(".test.ts") &&
      !e.name.endsWith(".d.ts")
    ) {
      acc.push(fp);
    }
  }
  return acc;
}

/** Strip line/block comments so a documented anti-pattern in prose never trips the guard. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// import.meta.url written through fileURLToPath() or new URL(), used as a path base.
const IMPORT_META = /import\.meta\.url/;
// A runtime filesystem READ of a path (not write).
const FS_READ = /\b(readFileSync|readFile|readdirSync|readdir)\s*\(/;
// (a) Fixed up-tree climb: a "../" appears in a string literal anchored to import.meta.url.
//     new URL("../../../../data/x.json", import.meta.url)  |  join(dirname(...url), "../../x")
const UP_CLIMB =
  /(?:new URL\(\s*["'`][^"'`]*\.\.\/[^"'`]*["'`]\s*,\s*import\.meta\.url|fileURLToPath\(\s*import\.meta\.url\s*\)[^;\n]*["'`][^"'`]*\.\.\/)/;
// (b) Sibling-dir read: dirname(fileURLToPath(import.meta.url)) used as a dir base with no "../".
const SIBLING_DIR = /dirname\(\s*fileURLToPath\(\s*import\.meta\.url\s*\)\s*\)/;

/**
 * Classify a single source file. Returns `{ kind }` for a forbidden site, else `null`.
 * Pure (string in → verdict out) so it is unit-testable without the filesystem.
 * @param {string} raw  full file source
 * @returns {{kind: "fixed-climb"|"sibling-dir"}|null}
 */
export function analyze(raw) {
  const src = stripComments(raw);
  if (!IMPORT_META.test(src)) return null; // no import.meta.url anchoring at all
  if (!FS_READ.test(src)) return null; // no runtime fs read → module-import / pure path: fine

  // Sanctioned: routes through a cwd-walk resolver (resolveRepoRoot / resolveSeedPath / bespoke).
  if (RESOLVER_MARKERS.some((m) => src.includes(m))) return null;

  const climb = UP_CLIMB.test(src);
  const sibling = SIBLING_DIR.test(src) && !climb; // sibling only if there is no up-climb form
  if (!climb && !sibling) return null;

  return { kind: climb ? "fixed-climb" : "sibling-dir" };
}

/** Exposed for the unit test: the allowlisted repo-relative paths. */
export const ALLOWLISTED_PATHS = ALLOWED;

function main() {
  const files = collect(SCAN_ROOT);
  const violations = [];
  const hitAllowed = new Set();

  for (const fp of files) {
    const rel = relative(ROOT, fp);
    const raw = readFileSync(fp, "utf8");
    const finding = analyze(raw);
    if (!finding) continue;
    if (ALLOWED.has(rel)) {
      hitAllowed.add(rel);
      continue;
    }
    violations.push({ rel, ...finding });
  }

  // Report (do NOT fail on) stale allowlist entries — the site was fixed; clean the list.
  const stale = ALLOWLIST.filter((e) => !hitAllowed.has(e.path) && existsSync(join(ROOT, e.path)));
  for (const e of stale) {
    console.log(
      `[check-bundled-asset-reads] note: allowlist entry no longer matches (fixed?) → ${e.path}\n` +
        `  remove it from ${SELF}`,
    );
  }

  if (violations.length > 0) {
    console.error(
      `\n[check-bundled-asset-reads] ✗ ${violations.length} forbidden bundled-asset read(s) — ` +
        `bundled adapter-node import.meta.url path overshoot (RISK-014 / REC-INC-008):\n`,
    );
    for (const v of violations) {
      const how =
        v.kind === "fixed-climb"
          ? 'a fixed "../"-climb relative to import.meta.url'
          : "a sibling-dir read of dirname(import.meta.url)";
      console.error(`  ✗ ${v.rel}\n      ${how} feeds a runtime fs read.`);
    }
    console.error(
      `\n  This overshoots/misses in the bundled adapter-node prod build → ENOENT / HTTP 500.\n` +
        `  Use a SANCTIONED pattern instead (see ${DOC}):\n` +
        `    • PREFERRED: module-import the asset — import x from "./x.json" (JSON) or Vite ?raw (text).\n` +
        `    • FALLBACK : the shared cwd-walk resolver — resolveRepoRoot (records gate) /\n` +
        `                 resolveSeedPath (apps/dashboard/src/lib/server/catalogue/seed-path.ts).\n` +
        `  Do NOT silence this by adding to the ALLOWLIST in ${SELF} — fix the site.\n`,
    );
    process.exit(1);
  }

  console.log(
    `[check-bundled-asset-reads] OK — scanned ${files.length} server modules; ` +
      `0 new forbidden asset reads (${ALLOWED.size} known site(s) allowlisted).`,
  );
}

// Run as a CLI; stay silent when imported by the unit test.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
