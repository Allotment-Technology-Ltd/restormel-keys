import { describe, expect, it, vi } from "vitest";

// parseQualityDelta is pure, but the module imports the server-only BYOK path.
vi.mock("./byok-chat", () => ({ generateByokJson: vi.fn() }));

import { parseQualityDelta } from "./analyseQualityDelta";

describe("parseQualityDelta", () => {
  it("parses a well-formed JSON object", () => {
    const raw = JSON.stringify({
      additional_specificity: "B cites the 1971 ruling A omits.",
      contradictions: "A claims X but the graph shows not-X.",
      hedging_resolved: "A hedged on dates; the graph gives 1971.",
      provenance_count: 4,
      verdict: "significant",
    });
    const delta = parseQualityDelta(raw, 4);
    expect(delta.verdict).toBe("significant");
    expect(delta.provenance_count).toBe(4);
    expect(delta.contradictions).toContain("not-X");
  });

  it("coerces 'null'/'none' string fields to null", () => {
    const raw = JSON.stringify({
      additional_specificity: "More specific.",
      contradictions: "null",
      hedging_resolved: "None",
      provenance_count: 2,
      verdict: "moderate",
    });
    const delta = parseQualityDelta(raw, 2);
    expect(delta.contradictions).toBeNull();
    expect(delta.hedging_resolved).toBeNull();
  });

  it("defaults an invalid verdict to moderate and uses claimCount for provenance", () => {
    const raw = JSON.stringify({ additional_specificity: "x", verdict: "huge" });
    const delta = parseQualityDelta(raw, 3);
    expect(delta.verdict).toBe("moderate");
    expect(delta.provenance_count).toBe(3);
  });

  it("falls back gracefully on non-JSON output", () => {
    const delta = parseQualityDelta("this is not json", 5);
    expect(["significant", "moderate", "minimal"]).toContain(delta.verdict);
    expect(delta.provenance_count).toBe(5);
    expect(typeof delta.additional_specificity).toBe("string");
  });
});
