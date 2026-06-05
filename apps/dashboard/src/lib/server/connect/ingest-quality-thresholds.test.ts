import { describe, expect, it } from "vitest";
import {
  buildThresholdBriefMarkdown,
  evaluateThresholds,
  summarizeReviewSignals,
} from "./ingest-quality-thresholds";
import type { ReviewSignalEvalRow } from "$lib/server/neon";

function rowsForArchetype(
  archetype: string,
  deltas: string[],
  overrides?: Partial<ReviewSignalEvalRow>[],
): ReviewSignalEvalRow[] {
  return deltas.map((verdict_delta, i) => ({
    verdict_delta,
    pack_archetype: archetype,
    ai_flag_theme: overrides?.[i]?.ai_flag_theme ?? null,
    human_note_theme: null,
    action_type: overrides?.[i]?.action_type ?? null,
  }));
}

describe("ingest-quality-thresholds", () => {
  it("fires weak_to_ok when rate exceeds threshold", () => {
    const deltas = [
      ...Array.from({ length: 8 }, () => "weak_to_ok"),
      ...Array.from({ length: 22 }, () => "agree_weak"),
    ];
    const fired = evaluateThresholds(rowsForArchetype("argumentative", deltas));
    expect(fired.some((f) => f.threshold === "weak_to_ok" && f.archetype === "argumentative")).toBe(
      true,
    );
  });

  it("does not fire when sample below minN", () => {
    const fired = evaluateThresholds(
      rowsForArchetype("generic", ["weak_to_ok", "weak_to_ok", "agree_ok"]),
    );
    expect(fired).toHaveLength(0);
  });

  it("summarizes agreement rate", () => {
    const rows = rowsForArchetype("generic", ["agree_ok", "agree_ok", "weak_to_ok"]);
    const summary = summarizeReviewSignals(rows, 7);
    expect(summary.signalCount).toBe(3);
    expect(summary.agreementPct).toBe(67);
  });

  it("builds brief markdown without user content", () => {
    const md = buildThresholdBriefMarkdown(
      [
        {
          archetype: "generic",
          threshold: "ok_to_weak",
          rate: 12,
          count: 3,
          total: 25,
          action: "tighten_validation_template",
        },
      ],
      7,
    );
    expect(md).toContain("generic");
    expect(md).toContain("tighten_validation_template");
    expect(md).toContain("Restormel Admin");
  });
});
