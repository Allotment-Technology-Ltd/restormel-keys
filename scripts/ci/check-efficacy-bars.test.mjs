/**
 * Unit tests for the claims-integrity bar checker (Stage 2.3). Run from the repo root:
 *   pnpm exec vitest run scripts/ci/check-efficacy-bars.test.mjs
 * Also exercised against the committed 2026-06-10 snapshot so the checker is proven on
 * real harness output, not only synthetic shapes.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateEfficacyBars, renderBarTable } from "./check-efficacy-bars.mjs";

const stat = (mean) => ({ mean, stddev: 0, min: mean, max: mean, n: 3 });
const agg = ({ fab, mis, ff, affirm }) => ({
  tiers: {
    fabricated: { recall_strict: stat(fab) },
    overstated: { recall_strict: stat(1) },
    misattributed: { recall_strict: stat(mis) },
  },
  supported_false_flag_rate: stat(ff),
  window_affirm_unseen_rate: stat(affirm ?? 0),
});

function snapshot({ legacy, ebv, relationship = "cross_model" }) {
  return {
    pairings: [
      {
        validator: "together:test-model",
        relationship,
        aggregated: agg(legacy),
        ...(ebv ? { ebv: { aggregated: agg(ebv) } } : {}),
      },
    ],
  };
}

describe("evaluateEfficacyBars", () => {
  it("passes when every signed-off bar is met on the cross-model pairing", () => {
    const result = evaluateEfficacyBars(
      snapshot({
        legacy: { fab: 1, mis: 1, ff: 0.14, affirm: 0 },
        ebv: { fab: 1, mis: 1, ff: 0.04, affirm: 1 }, // EBV affirm-unseen is exempt by design
      }),
    );
    expect(result.configError).toBeNull();
    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(7); // 3 legacy + affirm + 3 ebv
  });

  it("fails when fabricated recall drops below 95%", () => {
    const result = evaluateEfficacyBars(
      snapshot({ legacy: { fab: 0.94, mis: 1, ff: 0.1, affirm: 0 } }),
    );
    expect(result.ok).toBe(false);
    expect(result.checks.find((c) => !c.pass)?.label).toContain("fabricated");
  });

  it("fails when cross-model misattribution recall drops below 90%", () => {
    const result = evaluateEfficacyBars(
      snapshot({ legacy: { fab: 1, mis: 0.85, ff: 0.1, affirm: 0 } }),
    );
    expect(result.ok).toBe(false);
  });

  it("fails when false-flag exceeds 15% or affirm-unseen is non-zero (legacy)", () => {
    expect(
      evaluateEfficacyBars(snapshot({ legacy: { fab: 1, mis: 1, ff: 0.16, affirm: 0 } })).ok,
    ).toBe(false);
    expect(
      evaluateEfficacyBars(snapshot({ legacy: { fab: 1, mis: 1, ff: 0.1, affirm: 0.05 } })).ok,
    ).toBe(false);
  });

  it("config-errors without a cross-model pairing (never silently passes)", () => {
    const result = evaluateEfficacyBars(
      snapshot({ legacy: { fab: 1, mis: 1, ff: 0, affirm: 0 }, relationship: "same_model" }),
    );
    expect(result.configError).toMatch(/cross_model/);
    expect(result.ok).toBe(false);
  });

  it("accepts the committed 2026-06-10 EBV snapshot (real harness output)", () => {
    const real = JSON.parse(
      readFileSync(
        new URL("../reviews/verifier-efficacy-results-2026-06-10-ebv.json", import.meta.url),
        "utf8",
      ),
    );
    const result = evaluateEfficacyBars(real);
    expect(result.configError).toBeNull();
    expect(result.ok).toBe(true);
  });
});

describe("renderBarTable", () => {
  it("renders a markdown table with a regression callout", () => {
    const result = evaluateEfficacyBars(
      snapshot({ legacy: { fab: 0.9, mis: 1, ff: 0.1, affirm: 0 } }),
    );
    const table = renderBarTable(result, "x.json");
    expect(table).toContain("| Check | Measured | Bar | Status |");
    expect(table).toContain("❌ REGRESSED");
    expect(table).toContain("flip the citing rows to `broken`");
  });
});
