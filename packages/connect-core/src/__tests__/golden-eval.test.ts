import { describe, expect, it } from "vitest";
import { computeG2Metrics, assertG2Targets, G2_OK_PCT_TARGET } from "../ingest/golden-eval.js";
import { finalizeValidationCoverage, type UnitValidation } from "../ingest/validation.js";

function tally(results: UnitValidation[]): { ok: number; weak: number; unsupported: number } {
  const counts = { ok: 0, weak: 0, unsupported: 0 };
  for (const r of results) counts[r.status] += 1;
  return counts;
}

describe("computeG2Metrics", () => {
  it("computes ok_pct and unsupported_pct over all verdicts", () => {
    const m = computeG2Metrics({ ok: 9, weak: 1, unsupported: 0 });
    expect(m.ok_pct).toBe(90);
    expect(m.unsupported_pct).toBe(0);
  });

  it("omitted units no longer inflate ok_pct (C3)", () => {
    // 5 units sent to the validator; it returned verdicts for only 3 (all "ok").
    const units = [
      { ref: "u1", text: "A" },
      { ref: "u2", text: "B" },
      { ref: "u3", text: "C" },
      { ref: "u4", text: "D" },
      { ref: "u5", text: "E" },
    ];
    const judged: UnitValidation[] = [
      { ref: "u1", status: "ok" },
      { ref: "u2", status: "ok" },
      { ref: "u3", status: "ok" },
    ];
    const counts = tally(finalizeValidationCoverage(units, judged));
    // The two never-judged units must count as weak, not ok.
    expect(counts).toEqual({ ok: 3, weak: 2, unsupported: 0 });
    const m = computeG2Metrics(counts);
    expect(m.ok_pct).toBe(60);
    expect(m.ok_pct).toBeLessThan(G2_OK_PCT_TARGET);
    expect(assertG2Targets(m).pass).toBe(false);
  });

  it("full validator coverage still meets targets on a clean run", () => {
    const units = Array.from({ length: 10 }, (_, i) => ({ ref: `u${i}`, text: `t${i}` }));
    const judged: UnitValidation[] = units.map((u) => ({ ref: u.ref, status: "ok" as const }));
    const m = computeG2Metrics(tally(finalizeValidationCoverage(units, judged)));
    expect(m.ok_pct).toBe(100);
    expect(assertG2Targets(m).pass).toBe(true);
  });
});
