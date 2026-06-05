import { describe, expect, it } from "vitest";
import {
  isLegacyGraphSource,
  pickBestSourceMatch,
  scoreIdeaSourceMatch,
  unitNeedsSourceLink,
} from "./graph-source-link-matcher";

describe("scoreIdeaSourceMatch", () => {
  it("scores high when the idea text appears in the source", () => {
    const source =
      "Grace is the free and unmerited favour of God, as manifested in the salvation of sinners.";
    const idea = "Grace is the free and unmerited favour of God.";
    expect(scoreIdeaSourceMatch(idea, source)).toBeGreaterThan(40);
  });
});

describe("pickBestSourceMatch", () => {
  it("chooses the candidate with the strongest overlap", () => {
    const idea = "Socrates taught that virtue is a kind of knowledge.";
    const match = pickBestSourceMatch(idea, [
      { graphSourceId: "a", text: "Plato wrote about forms and ideals." },
      {
        graphSourceId: "b",
        text: "Socrates taught that virtue is a kind of knowledge and no one errs willingly.",
      },
    ]);
    expect(match?.candidate.graphSourceId).toBe("b");
  });
});

describe("unitNeedsSourceLink", () => {
  it("flags legacy placeholder sources", () => {
    expect(
      unitNeedsSourceLink({
        sourceKind: "legacy",
        sourceTitle: "Legacy ideas (source not recorded at ingest)",
        sourceUrl: null,
        resolvedQuality: "preview",
      }),
    ).toBe(true);
    expect(isLegacyGraphSource({ sourceKind: "legacy", sourceTitle: "x" })).toBe(true);
  });
});
