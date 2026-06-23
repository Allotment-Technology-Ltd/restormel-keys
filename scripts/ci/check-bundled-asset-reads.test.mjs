/**
 * Unit tests for the bundled adapter-node asset-read guard.
 * Dependency-free — uses node's built-in test runner (no vitest install needed):
 *   node --test scripts/ci/check-bundled-asset-reads.test.mjs
 *
 * Proves the classifier (`analyze`) fails the two forbidden shapes (RISK-014 / REC-INC-008)
 * and passes the sanctioned patterns, so a refactor of the regexes cannot silently regress it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./check-bundled-asset-reads.mjs";

// ── forbidden shapes (must be flagged) ──────────────────────────────────────

test("flags a fixed up-tree climb via new URL(..., import.meta.url) + readFileSync", () => {
  const src = `
    import { readFileSync } from "node:fs";
    import { fileURLToPath } from "node:url";
    const SEED = new URL("../../../../data/x.json", import.meta.url);
    export const x = readFileSync(fileURLToPath(SEED), "utf8");
  `;
  assert.deepEqual(analyze(src), { kind: "fixed-climb" });
});

test("flags a fixed up-tree climb via join(dirname(fileURLToPath(import.meta.url)), '../..')", () => {
  const src = `
    import { readFileSync } from "node:fs";
    import { join, dirname } from "node:path";
    import { fileURLToPath } from "node:url";
    const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");
    export const y = readFileSync(join(ROOT, "governance/suppliers.yaml"), "utf8");
  `;
  assert.deepEqual(analyze(src), { kind: "fixed-climb" });
});

test("flags a sibling-dir read of dirname(import.meta.url) + readdirSync", () => {
  const src = `
    import { readFileSync, readdirSync } from "node:fs";
    import { join, dirname } from "node:path";
    import { fileURLToPath } from "node:url";
    const DIR = join(dirname(fileURLToPath(import.meta.url)), "starter-corpus");
    const files = readdirSync(DIR);
    export const z = readFileSync(join(DIR, files[0]), "utf8");
  `;
  assert.deepEqual(analyze(src), { kind: "sibling-dir" });
});

// ── sanctioned patterns (must pass) ─────────────────────────────────────────

test("passes module-import (import x from './x.json' + Vite ?raw) — no runtime fs", () => {
  const src = `
    import manifest from "./starter-corpus/manifest.json";
    import body from "./starter-corpus/01.md?raw";
    export const corpus = { manifest, body };
  `;
  assert.equal(analyze(src), null);
});

test("passes the shared resolver (resolveSeedPath) even though the climb literal remains", () => {
  const src = `
    import { readFileSync } from "node:fs";
    import { fileURLToPath } from "node:url";
    import { resolveSeedPath } from "./seed-path";
    const SEED_PATH = resolveSeedPath(
      fileURLToPath(new URL("../../../../data/model-catalog-seed.json", import.meta.url)),
    );
    export const raw = readFileSync(SEED_PATH, "utf8");
  `;
  assert.equal(analyze(src), null);
});

test("passes a bespoke cwd-walk resolver (pnpm-workspace.yaml marker + readFileSync)", () => {
  const src = `
    import { readFileSync, existsSync } from "node:fs";
    import { join, dirname } from "node:path";
    import { fileURLToPath } from "node:url";
    function resolve() {
      const rel = join(dirname(fileURLToPath(import.meta.url)), "../../../../data/x.json");
      if (existsSync(rel)) return rel;
      let dir = process.cwd();
      for (let i = 0; i < 8; i++) {
        if (existsSync(join(dir, "pnpm-workspace.yaml"))) return join(dir, "apps/dashboard/data/x.json");
        dir = dirname(dir);
      }
      return rel;
    }
    export const w = readFileSync(resolve(), "utf8");
  `;
  assert.equal(analyze(src), null);
});

test("passes a module that uses import.meta.url for a pure path (no fs read)", () => {
  const src = `
    import { dirname } from "node:path";
    import { fileURLToPath } from "node:url";
    export const HERE = dirname(fileURLToPath(import.meta.url));
  `;
  assert.equal(analyze(src), null);
});

test("does not trip on the anti-pattern appearing only inside a comment", () => {
  const src = `
    // BAD: const SEED = new URL("../../../../data/x.json", import.meta.url);
    //      readFileSync(fileURLToPath(SEED)) overshoots in the bundle.
    import good from "./x.json";
    export const x = good;
  `;
  assert.equal(analyze(src), null);
});
