import { describe, expect, it } from "vitest";
import {
  buildEntailmentBatchInputs,
  buildEntailmentUserPrompt,
  finalizeEntailmentCoverage,
  judgeEntailment,
  parseEntailmentResponse,
  resolveSelfConsistency,
  type EntailmentInput,
} from "../ingest/entailment.js";
import {
  deriveLayer2State,
  entailmentToLegacyStatus,
} from "../ingest/verification-state.js";
import type { EvidenceBinding } from "../ingest/evidence-binding.js";

const BOUND: EvidenceBinding = {
  status: "bound",
  span: { quote: "q", start: 0, end: 1, source_hash: "h", match: "exact" },
};
const UNBOUND: EvidenceBinding = { status: "unbound", reason: "quote_not_found" };

function input(ref: string, spans: string[] = ["some quoted evidence"]): EntailmentInput {
  return { ref, claim: `claim ${ref}`, spans };
}

describe("parseEntailmentResponse", () => {
  it("parses verdicts and clamps confidence", () => {
    const out = parseEntailmentResponse(
      JSON.stringify({
        results: [
          { ref: "e1", verdict: "entailed", confidence: 1.7 },
          { ref: "e2", verdict: "not_entailed", confidence: 0.9, note: "overstates" },
          { ref: "e3", verdict: "abstain" },
        ],
      }),
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ ref: "e1", verdict: "entailed", confidence: 1 });
    expect(out[1]).toMatchObject({ verdict: "not_entailed", note: "overstates" });
    expect(out[2]).toMatchObject({ verdict: "abstain", confidence: null });
  });

  it("fail-safe: unknown verdicts become abstain with the unparseable marker", () => {
    const out = parseEntailmentResponse(
      JSON.stringify({ results: [{ ref: "e1", verdict: "supported", note: "looks fine" }] }),
    );
    expect(out[0]!.verdict).toBe("abstain");
    expect(out[0]!.note).toContain("unparseable_verdict");
  });

  it("fail-safe: garbage and prose-wrapped JSON", () => {
    expect(parseEntailmentResponse("total garbage")).toEqual([]);
    const wrapped = parseEntailmentResponse(
      'Sure! {"results":[{"ref":"e1","verdict":"entailed","confidence":0.8}]}',
    );
    expect(wrapped[0]).toMatchObject({ verdict: "entailed", confidence: 0.8 });
  });
});

describe("finalizeEntailmentCoverage (PR #189 semantics)", () => {
  it("an omitted claim is a coverage-gap abstention, never a pass", () => {
    const inputs = [input("u1"), input("u2")];
    const out = finalizeEntailmentCoverage(inputs, [
      { ref: "u1", verdict: "entailed", confidence: 0.9 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ ref: "u2", verdict: "abstain" });
    expect(out[1]!.note).toContain("coverage_gap");
  });
});

describe("resolveSelfConsistency", () => {
  it("strict majority wins and confidences average over agreeing samples", () => {
    const out = resolveSelfConsistency([
      { ref: "u1", verdict: "entailed", confidence: 0.8 },
      { ref: "u1", verdict: "entailed", confidence: 0.6 },
      { ref: "u1", verdict: "not_entailed", confidence: 0.9 },
    ]);
    expect(out.verdict).toBe("entailed");
    expect(out.confidence).toBeCloseTo(0.7);
  });

  it("disagreement (no strict majority) abstains → review", () => {
    const out = resolveSelfConsistency([
      { ref: "u1", verdict: "entailed", confidence: 0.9 },
      { ref: "u1", verdict: "not_entailed", confidence: 0.9 },
    ]);
    expect(out.verdict).toBe("abstain");
    expect(out.note).toContain("self_consistency_disagreement");
  });
});

describe("judgeEntailment", () => {
  it("claims with no spans never reach the judge and abstain locally", async () => {
    let calls = 0;
    const { results } = await judgeEntailment({
      inputs: [input("u1", [])],
      generate: async () => {
        calls += 1;
        return "{}";
      },
    });
    expect(calls).toBe(0);
    expect(results[0]).toMatchObject({ ref: "u1", verdict: "abstain" });
    expect(results[0]!.note).toContain("no_bound_evidence");
  });

  it("judges spanned claims, remaps refs, and records meta", async () => {
    const seen: string[] = [];
    const { results, meta } = await judgeEntailment({
      inputs: [input("unit:alpha"), input("unit:beta", [])],
      generate: async ({ user }) => {
        seen.push(user);
        return JSON.stringify({
          results: [{ ref: "e1", verdict: "entailed", confidence: 0.95 }],
        });
      },
      modelId: "test:judge-1",
    });
    expect(seen[0]).toContain("CLAIM e1");
    expect(seen[0]).toContain("some quoted evidence");
    const byRef = new Map(results.map((r) => [r.ref, r]));
    expect(byRef.get("unit:alpha")).toMatchObject({ verdict: "entailed" });
    expect(byRef.get("unit:beta")).toMatchObject({ verdict: "abstain" });
    expect(meta.model_id).toBe("test:judge-1");
    expect(meta.prompt_version).toBeGreaterThan(0);
    expect(meta.samples).toBe(1);
  });

  it("k-sample disagreement routes to abstain", async () => {
    let call = 0;
    const { results } = await judgeEntailment({
      inputs: [input("u1")],
      kSamples: 2,
      generate: async () => {
        call += 1;
        return JSON.stringify({
          results: [
            { ref: "e1", verdict: call === 1 ? "entailed" : "not_entailed", confidence: 0.9 },
          ],
        });
      },
    });
    expect(results[0]!.verdict).toBe("abstain");
  });
});

describe("buildEntailmentBatchInputs", () => {
  it("clusters claims sharing a span and short-refs each batch", () => {
    const batches = buildEntailmentBatchInputs([
      { ref: "a", claim: "c1", spans: ["zz shared"] },
      { ref: "b", claim: "c2", spans: ["aa other"] },
      { ref: "c", claim: "c3", spans: ["zz shared"] },
    ]);
    const flat = batches.flatMap((b) => b.batchInputs.map((i) => i.spans[0]));
    const sharedIdx = flat.map((s, i) => (s === "zz shared" ? i : -1)).filter((i) => i >= 0);
    expect(sharedIdx[1]! - sharedIdx[0]!).toBe(1);
    expect(batches[0]!.batchInputs[0]!.ref).toBe("e1");
  });
});

describe("deriveLayer2State", () => {
  it("supported requires Layer 1 bound AND entailed", () => {
    expect(
      deriveLayer2State({ binding: BOUND, verdict: "entailed", confidence: 0.9 }),
    ).toBe("supported");
    expect(
      deriveLayer2State({ binding: UNBOUND, verdict: "entailed", confidence: 0.9 }),
    ).toBe("inferred");
  });

  it("low confidence and abstention route to unverified (review)", () => {
    expect(
      deriveLayer2State({ binding: BOUND, verdict: "entailed", confidence: 0.3 }),
    ).toBe("unverified");
    expect(
      deriveLayer2State({ binding: BOUND, verdict: "abstain", confidence: null }),
    ).toBe("unverified");
    expect(
      deriveLayer2State({ binding: BOUND, verdict: "not_entailed", confidence: 0.9 }),
    ).toBe("unverified");
  });
});

describe("entailmentToLegacyStatus", () => {
  it("projects verdicts onto the legacy column", () => {
    expect(
      entailmentToLegacyStatus({ ref: "u", verdict: "entailed", confidence: 0.9 }),
    ).toBe("ok");
    expect(
      entailmentToLegacyStatus({ ref: "u", verdict: "entailed", confidence: 0.2 }),
    ).toBe("weak");
    expect(
      entailmentToLegacyStatus({ ref: "u", verdict: "not_entailed", confidence: 0.9 }),
    ).toBe("unsupported");
    expect(
      entailmentToLegacyStatus({ ref: "u", verdict: "abstain", confidence: null }),
    ).toBe("weak");
  });
});

describe("buildEntailmentUserPrompt", () => {
  it("caps spans at 3 per claim", () => {
    const prompt = buildEntailmentUserPrompt([
      { ref: "e1", claim: "c", spans: ["s1", "s2", "s3", "s4"] },
    ]);
    expect(prompt).toContain("span 3");
    expect(prompt).not.toContain("span 4");
  });
});
