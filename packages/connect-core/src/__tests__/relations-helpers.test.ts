import { describe, expect, it } from "vitest";
import {
  buildRelationsBatches,
  mergeRelationsDedup,
  relationConfidenceFromStrength,
  relationDedupeKey,
} from "../stages/relations-helpers.js";

describe("relations-helpers", () => {
  it("maps relation strength to confidence", () => {
    expect(relationConfidenceFromStrength("strong")).toBe(0.9);
    expect(relationConfidenceFromStrength("weak")).toBe(0.58);
    expect(relationConfidenceFromStrength(undefined)).toBe(0.74);
  });

  it("dedupes relations by position pair and type", () => {
    const key = relationDedupeKey({
      from_position: 1,
      to_position: 2,
      relation_type: "supports",
    });
    expect(key).toBe("1:2:supports");
  });

  it("merges incoming relations preferring higher confidence", () => {
    const merged = mergeRelationsDedup(
      [{ from_position: 1, to_position: 2, relation_type: "supports", relation_confidence: 0.5 }],
      [{ from_position: 1, to_position: 2, relation_type: "supports", relation_confidence: 0.9 }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.relation_confidence).toBe(0.9);
  });

  it("splits claims into token-bounded batches", () => {
    const wordyText = Array.from({ length: 80 }, () => "claim").join(" ");
    const claims = Array.from({ length: 5 }, (_, i) => ({
      position_in_source: i + 1,
      text: wordyText,
    }));
    const batches = buildRelationsBatches(claims, 50, 0);
    expect(batches.length).toBeGreaterThan(1);
  });
});
