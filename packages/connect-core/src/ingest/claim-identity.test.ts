/**
 * Stage 3.2 — claim identity determinism + incremental re-ingest planning
 * (docs/decisions/verified-memory-incremental-ingest.md).
 */
import { describe, expect, it } from "vitest";
import {
  buildSupersessionTrace,
  computeClaimKey,
  deriveClaimSourceKey,
  planIncrementalReingest,
  type ClaimVersionChainRow,
  type PriorClaimVersion,
} from "./claim-identity.js";

function prior(over: Partial<PriorClaimVersion> & Pick<PriorClaimVersion, "versionId" | "unitId">): PriorClaimVersion {
  return {
    claimKey: null,
    versionNo: 1,
    text: "",
    verificationState: "supported",
    judgedBy: "judge#pv1",
    judgedAt: "2026-06-01T00:00:00.000Z",
    validationStatus: "ok",
    validationNote: null,
    ...over,
  };
}

describe("deriveClaimSourceKey", () => {
  it("prefers canonical url, then url, then normalized title", () => {
    expect(
      deriveClaimSourceKey({ canonicalUrl: "https://a.example/x", url: "https://b.example/y" }),
    ).toBe("url:https://a.example/x");
    expect(deriveClaimSourceKey({ url: "https://b.example/y" })).toBe("url:https://b.example/y");
    expect(deriveClaimSourceKey({ title: "  Bentham —  Notes " })).toBe(
      deriveClaimSourceKey({ title: "bentham - notes" }),
    );
    expect(deriveClaimSourceKey({})).toBe("untitled");
  });
});

describe("computeClaimKey", () => {
  it("is stable under whitespace/quote/dash/case drift in the evidence quote", async () => {
    const a = await computeClaimKey({
      sourceKey: "url:https://a.example/x",
      evidenceQuote: "Bentham's  “felicific calculus” — counts equally.",
      text: "irrelevant for quote identity",
    });
    const b = await computeClaimKey({
      sourceKey: "url:https://a.example/x",
      evidenceQuote: "bentham's \"felicific calculus\" - counts   equally.",
      text: "totally different claim wording",
    });
    expect(a).toBe(b);
  });

  it("differs across sources and across quotes", async () => {
    const base = { evidenceQuote: "same quote", text: "t" };
    const a = await computeClaimKey({ sourceKey: "url:a", ...base });
    const b = await computeClaimKey({ sourceKey: "url:b", ...base });
    const c = await computeClaimKey({ sourceKey: "url:a", evidenceQuote: "other quote", text: "t" });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("falls back to normalized text identity when no quote exists — and the two key spaces never collide", async () => {
    const quoteKey = await computeClaimKey({ sourceKey: "url:a", evidenceQuote: "Same words", text: "x" });
    const textKey = await computeClaimKey({ sourceKey: "url:a", evidenceQuote: null, text: "Same words" });
    const textKey2 = await computeClaimKey({ sourceKey: "url:a", evidenceQuote: "", text: "same  WORDS" });
    expect(textKey).toBe(textKey2);
    expect(quoteKey).not.toBe(textKey);
  });
});

describe("planIncrementalReingest", () => {
  it("classifies carried / changed / added / removed", () => {
    const plan = planIncrementalReingest({
      prior: [
        prior({ versionId: "1", unitId: "old-a", claimKey: "k-same", text: "Pleasure is the only good." }),
        prior({ versionId: "2", unitId: "old-b", claimKey: "k-edit", text: "Mill ranks pleasures." }),
        prior({ versionId: "3", unitId: "old-c", claimKey: "k-gone", text: "Kant was a utilitarian." }),
      ],
      next: [
        { unitId: "new-a", text: "Pleasure  is the only good.", claimKey: "k-same" }, // whitespace drift → carried
        { unitId: "new-b", text: "Mill ranks higher above lower pleasures.", claimKey: "k-edit" },
        { unitId: "new-d", text: "Sidgwick systematised the view.", claimKey: "k-new" },
      ],
    });
    expect(plan.carried.map((c) => [c.next.unitId, c.prior.unitId])).toEqual([["new-a", "old-a"]]);
    expect(plan.changed.map((c) => [c.next.unitId, c.prior.unitId])).toEqual([["new-b", "old-b"]]);
    expect(plan.added.map((a) => a.unitId)).toEqual(["new-d"]);
    expect(plan.removed.map((r) => r.unitId)).toEqual(["old-c"]);
  });

  it("never matches legacy prior rows without a claim key — they are superseded, not silently kept", () => {
    const plan = planIncrementalReingest({
      prior: [prior({ versionId: "1", unitId: "legacy", claimKey: null, text: "Old claim." })],
      next: [{ unitId: "new", text: "Old claim.", claimKey: "k1" }],
    });
    expect(plan.removed.map((r) => r.unitId)).toEqual(["legacy"]);
    expect(plan.added.map((a) => a.unitId)).toEqual(["new"]);
  });

  it("resolves duplicate keys deterministically (highest prior version matches; extra next-claims add)", () => {
    const plan = planIncrementalReingest({
      prior: [
        prior({ versionId: "1", unitId: "old-v1", claimKey: "k", versionNo: 1, text: "t" }),
        prior({ versionId: "2", unitId: "old-v2", claimKey: "k", versionNo: 2, text: "t" }),
      ],
      next: [
        { unitId: "new-1", text: "t", claimKey: "k" },
        { unitId: "new-2", text: "t", claimKey: "k" },
      ],
    });
    expect(plan.carried).toHaveLength(1);
    expect(plan.carried[0]!.prior.unitId).toBe("old-v2");
    expect(plan.added.map((a) => a.unitId)).toEqual(["new-2"]);
    // The unmatched duplicate prior row is still closed out, never orphaned.
    expect(plan.removed.map((r) => r.unitId)).toEqual(["old-v1"]);
  });

  it("an empty next set supersedes every prior claim (document emptied)", () => {
    const plan = planIncrementalReingest({
      prior: [prior({ versionId: "1", unitId: "a", claimKey: "k", text: "t" })],
      next: [],
    });
    expect(plan.removed).toHaveLength(1);
    expect(plan.carried).toHaveLength(0);
  });
});

describe("buildSupersessionTrace", () => {
  const row = (over: Partial<ClaimVersionChainRow> & Pick<ClaimVersionChainRow, "versionId" | "versionNo">): ClaimVersionChainRow => ({
    unitId: `u${over.versionId}`,
    text: "t",
    verificationState: "supported",
    sourceHash: "h",
    validFrom: "2026-06-01T00:00:00.000Z",
    validTo: null,
    supersededBy: null,
    ...over,
  });

  it("orders the chain and confirms forward links resolve", () => {
    const trace = buildSupersessionTrace([
      row({ versionId: "9", versionNo: 2, validTo: "2026-06-09T00:00:00.000Z", supersededBy: "12" }),
      row({ versionId: "3", versionNo: 1, validTo: "2026-06-05T00:00:00.000Z", supersededBy: "9" }),
      row({ versionId: "12", versionNo: 3 }),
    ]);
    expect(trace.chain.map((r) => r.versionNo)).toEqual([1, 2, 3]);
    expect(trace.current?.versionId).toBe("12");
    expect(trace.intact).toBe(true);
  });

  it("a removed claim's chain ends closed with no successor — superseded, not orphaned", () => {
    const trace = buildSupersessionTrace([
      row({ versionId: "1", versionNo: 1, validTo: "2026-06-09T00:00:00.000Z", supersededBy: null }),
    ]);
    expect(trace.current).toBeNull();
    expect(trace.intact).toBe(true);
  });

  it("flags a broken chain (superseded_by pointing at a missing row)", () => {
    const trace = buildSupersessionTrace([
      row({ versionId: "1", versionNo: 1, validTo: "2026-06-09T00:00:00.000Z", supersededBy: "404" }),
    ]);
    expect(trace.intact).toBe(false);
  });
});
