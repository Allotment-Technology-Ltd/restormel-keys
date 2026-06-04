import { describe, expect, it } from "vitest";
import { computeKgBalanceMultiplier, IDEAL_RETRIEVAL_ORIGIN_FRACTIONS } from "../kg-balance.js";

describe("computeKgBalanceMultiplier", () => {
  it("boosts origins below their ideal share", () => {
    const selectedOriginCounts = { sep: 0, gutenberg: 2, other: 0 };
    const selectedDomainCounts = new Map<string, number>([["ethics", 2]]);
    const multSep = computeKgBalanceMultiplier({
      origin: "sep",
      domain: "ethics",
      selectedOriginCounts,
      selectedDomainCounts,
      totalSelected: 2,
      idealOrigin: IDEAL_RETRIEVAL_ORIGIN_FRACTIONS,
      domainsInPool: new Set(["ethics", "metaphysics"]),
    });
    const multGut = computeKgBalanceMultiplier({
      origin: "gutenberg",
      domain: "ethics",
      selectedOriginCounts,
      selectedDomainCounts,
      totalSelected: 2,
      idealOrigin: IDEAL_RETRIEVAL_ORIGIN_FRACTIONS,
      domainsInPool: new Set(["ethics", "metaphysics"]),
    });
    expect(multSep).toBeGreaterThan(multGut);
    expect(multSep).toBeGreaterThan(1);
  });
});
