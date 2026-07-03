#!/usr/bin/env node
/**
 * Dogfood input builder for the connect-eval CI gate (Stage 2.3).
 *
 * Merges the pinned gate-mechanics counts (philosophy-starter-counts.json) with the LIVE
 * source-set fingerprint computed from PHILOSOPHY_STARTER_GOLDEN in the built
 * @restormel/connect-core. The fingerprint is computed at run time on purpose:
 *   - a PR that changes the philosophy starter fixture (or the fingerprint function)
 *     flips the gate to "baseline superseded" — visible in the sticky PR comment;
 *   - a PR that changes the G2 math/targets changes the verdict itself.
 *
 * Usage: node scripts/ci/connect-eval/build-counts.mjs --out <file> [--regress]
 *   --regress  emit a deliberately regressed (but absolute-bar-passing) variant for the
 *              exit-code contract probe (expects `keys connect eval --baseline` exit 3).
 *
 * Requires `pnpm --filter @restormel/connect-core run build` first (imports dist).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
let out = "";
let regress = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") out = args[++i] ?? "";
  else if (args[i] === "--regress") regress = true;
  else {
    console.error(`Unknown arg: ${args[i]}`);
    process.exit(2);
  }
}
if (!out) {
  console.error("Usage: build-counts.mjs --out <file> [--regress]");
  process.exit(2);
}

const goldenEvalJs = path.join(here, "../../../packages/connect-core/dist/ingest/golden-eval.js");
const { PHILOSOPHY_STARTER_GOLDEN, goldenExtractionEvalFingerprint } = await import(
  goldenEvalJs
).catch((e) => {
  console.error(
    `Could not import ${goldenEvalJs} — build connect-core first ` +
      `(pnpm --filter @restormel/connect-core run build): ${e instanceof Error ? e.message : e}`,
  );
  process.exit(2);
});

const pinned = JSON.parse(readFileSync(path.join(here, "philosophy-starter-counts.json"), "utf8"));
const fingerprint = goldenExtractionEvalFingerprint(PHILOSOPHY_STARTER_GOLDEN.items);

const counts = {
  ok: pinned.ok,
  weak: pinned.weak,
  unsupported: pinned.unsupported,
  trust_score: pinned.trust_score,
  coverage_gaps: pinned.coverage_gaps,
  fingerprint,
};

if (regress) {
  // Move 4 ok -> weak and shave trust: still passes the absolute G2 bar (93% >= 90%),
  // but drops ok_pct beyond the default 1-point tolerance vs the committed baseline,
  // so `keys connect eval --baseline ... ` must exit 3 (regression).
  counts.ok = pinned.ok - 4;
  counts.weak = pinned.weak + 4;
  counts.trust_score = Math.max(0, pinned.trust_score - 6);
}

writeFileSync(out, JSON.stringify(counts, null, 2) + "\n", "utf8");
console.log(
  `Wrote ${out} (${regress ? "regressed probe" : "pinned"} counts, fingerprint ${fingerprint})`,
);
