#!/usr/bin/env node
/**
 * Claims-integrity bar check for the scheduled verifier-efficacy run (Stage 2.3).
 *
 * Reads a results snapshot produced by scripts/reviews/verifier-efficacy.ts and asserts
 * the signed-off efficacy bars (product owner, 2026-06-10 — quoted in the roadmap and in
 * docs/verified-context-claims-ledger.md):
 *
 *   On the CROSS-MODEL pairing (the product's default routing):
 *     - fabricated-tier strict recall   >= 95%   (legacy AND EBV paths)
 *     - misattributed-tier strict recall >= 90%  (legacy AND EBV paths)
 *     - supported false-flag rate       <= 15%   (legacy AND EBV paths)
 *     - window-probe affirm-unseen      == 0%    (LEGACY path only: the probe measures the
 *       12k-char validation window; the EBV path deliberately judges the bound evidence
 *       span, so "seeing" beyond-window evidence is correct behavior there, not fail-open)
 *
 * Exit codes: 0 all bars met / 1 a signed-off bar regressed / 2 snapshot shape error.
 * Pure evaluation is exported for unit tests; the CLI wrapper adds the step summary.
 */
import { appendFileSync, readFileSync } from "node:fs";

export const BARS = {
  fabricated_recall_min: 0.95,
  misattributed_recall_min: 0.9,
  false_flag_max: 0.15,
  affirm_unseen_max: 0,
};

const pct = (x) => `${(x * 100).toFixed(1)}%`;

/**
 * Evaluate the signed-off bars against a parsed snapshot.
 * Returns { ok, configError, checks: [{ label, value, bar, pass }] }.
 */
export function evaluateEfficacyBars(report) {
  const pairings = Array.isArray(report?.pairings) ? report.pairings : [];
  const cross = pairings.filter((p) => p?.relationship === "cross_model");
  if (cross.length === 0) {
    return {
      ok: false,
      configError:
        "No cross_model pairing in the snapshot — the scheduled run must pair an extractor " +
        "with at least one validator from a different model family.",
      checks: [],
    };
  }

  const checks = [];
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  for (const p of cross) {
    const paths = [["legacy", p.aggregated]];
    if (p.ebv?.aggregated) paths.push(["ebv", p.ebv.aggregated]);
    for (const [label, agg] of paths) {
      const fab = num(agg?.tiers?.fabricated?.recall_strict?.mean);
      const mis = num(agg?.tiers?.misattributed?.recall_strict?.mean);
      const ff = num(agg?.supported_false_flag_rate?.mean);
      if (fab === null || mis === null || ff === null) {
        return {
          ok: false,
          configError: `Pairing ${p.validator} (${label}) is missing aggregated tier metrics.`,
          checks: [],
        };
      }
      checks.push({
        label: `${p.validator} · ${label} · fabricated recall`,
        value: pct(fab),
        bar: `>= ${pct(BARS.fabricated_recall_min)}`,
        pass: fab >= BARS.fabricated_recall_min,
      });
      checks.push({
        label: `${p.validator} · ${label} · misattributed recall`,
        value: pct(mis),
        bar: `>= ${pct(BARS.misattributed_recall_min)}`,
        pass: mis >= BARS.misattributed_recall_min,
      });
      checks.push({
        label: `${p.validator} · ${label} · false-flag rate`,
        value: pct(ff),
        bar: `<= ${pct(BARS.false_flag_max)}`,
        pass: ff <= BARS.false_flag_max,
      });
      if (label === "legacy") {
        const affirm = num(agg?.window_affirm_unseen_rate?.mean);
        if (affirm === null) {
          return {
            ok: false,
            configError: `Pairing ${p.validator} (legacy) is missing window_affirm_unseen_rate.`,
            checks: [],
          };
        }
        checks.push({
          label: `${p.validator} · legacy · affirm-unseen (window probe)`,
          value: pct(affirm),
          bar: `== ${pct(BARS.affirm_unseen_max)}`,
          pass: affirm <= BARS.affirm_unseen_max,
        });
      }
    }
  }

  return { ok: checks.every((c) => c.pass), configError: null, checks };
}

/** Markdown table for the step summary / ledger evidence. */
export function renderBarTable(result, snapshotName) {
  const out = [
    "## Verifier efficacy — signed-off bars (cross-model)",
    "",
    `Snapshot: \`${snapshotName}\``,
    "",
    "| Check | Measured | Bar | Status |",
    "|---|---:|---:|:--|",
  ];
  for (const c of result.checks) {
    out.push(`| ${c.label} | ${c.value} | ${c.bar} | ${c.pass ? "✓ ok" : "❌ REGRESSED"} |`);
  }
  out.push("");
  out.push(
    result.ok
      ? "**All signed-off bars met.** Claims-ledger rows citing these bars remain proven."
      : "**A signed-off bar regressed.** Per docs/verified-context-claims-ledger.md rule 3, flip the citing rows to `broken` and treat dependent marketing copy as broken until the bar recovers.",
  );
  return out.join("\n");
}

const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/ci/check-efficacy-bars.mjs <verifier-efficacy-results.json>");
    process.exit(2);
  }
  let report;
  try {
    report = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`Could not read snapshot ${file}: ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
  const result = evaluateEfficacyBars(report);
  if (result.configError) {
    console.error(result.configError);
    process.exit(2);
  }
  const table = renderBarTable(result, file);
  console.log(table);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`, "utf8");
  }
  process.exit(result.ok ? 0 : 1);
}
