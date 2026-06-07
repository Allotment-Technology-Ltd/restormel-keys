import { describe, expect, it } from "vitest";
import {
  inferSourceTextQualityForLink,
  isLegacyGraphSource,
  pickBestPreparedSourceMatch,
  pickBestSourceMatch,
  prepareSourceMatchCandidates,
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

describe("prepareSourceMatchCandidates / pickBestPreparedSourceMatch", () => {
  it("matches the same winner as the unprepared path", () => {
    const idea = "Socrates taught that virtue is a kind of knowledge.";
    const candidates = [
      { graphSourceId: "a", text: "Plato wrote about forms and ideals." },
      {
        graphSourceId: "b",
        text: "Socrates taught that virtue is a kind of knowledge and no one errs willingly.",
      },
    ];
    const unprepared = pickBestSourceMatch(idea, candidates);
    const prepared = pickBestPreparedSourceMatch(idea, prepareSourceMatchCandidates(candidates));
    expect(prepared?.candidate.graphSourceId).toBe(unprepared?.candidate.graphSourceId);
    expect(prepared?.score).toBe(unprepared?.score);
  });
});

describe("inferSourceTextQualityForLink", () => {
  it("treats fetched inline source bodies as full quality", () => {
    expect(
      inferSourceTextQualityForLink({
        textPreview: null,
        sourceTitle: "Ethics",
        sourceUrl: null,
        sourceInlineText: "Full chapter text from Surreal FETCH.",
      }),
    ).toBe("full");
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

  it("does not re-link ideas that already have a Surreal source edge", () => {
    expect(
      unitNeedsSourceLink({
        sourceKind: null,
        sourceTitle: null,
        sourceUrl: null,
        sourceKey: "source:ethics-nicomachean",
        resolvedQuality: "missing",
      }),
    ).toBe(false);
  });

  it("still flags ideas with no source edge", () => {
    expect(
      unitNeedsSourceLink({
        sourceKind: null,
        sourceTitle: null,
        sourceUrl: null,
        sourceKey: null,
        resolvedQuality: "missing",
      }),
    ).toBe(true);
  });
});
