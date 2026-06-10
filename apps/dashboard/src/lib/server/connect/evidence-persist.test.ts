import { describe, expect, it } from "vitest";
import {
  buildEvidenceRows,
  buildLayer2StateRows,
  buildVerificationStateRows,
} from "./evidence-persist";
import type { EntailmentJudgeMeta } from "@restormel/connect-core";

const SOURCE =
  "Bentham introduced a felicific calculus. Every person's happiness counts equally in the aggregate.";
const HASH = "hash-1";

describe("buildEvidenceRows", () => {
  it("binds stored units via their extraction twin's quote and counts statuses", () => {
    const out = buildEvidenceRows({
      extractedUnits: [
        { id: "u1", evidence: "Every person's happiness counts equally in the aggregate." },
        { id: "u2", evidence: "A quote that exists nowhere in this source text at all." },
        { id: "u3" },
      ],
      storedUnits: [
        { id: "kg:aaa", localId: "u1", text: "Happiness counts equally." },
        { id: "kg:bbb", localId: "u2", text: "Unfounded claim." },
        { id: "kg:ccc", localId: "u3", text: "No quote given." },
      ],
      sourceText: SOURCE,
      sourceHash: HASH,
    });
    expect(out.counts).toEqual({ bound: 1, unbound: 1, no_evidence: 1 });
    expect(out.rows.map((r) => [r.unitId, r.binding.status])).toEqual([
      ["kg:aaa", "bound"],
      ["kg:bbb", "unbound"],
      ["kg:ccc", "no_evidence"],
    ]);
    const bound = out.bindingByUnitId.get("kg:aaa");
    expect(bound?.status).toBe("bound");
    if (bound?.status === "bound") expect(bound.span.source_hash).toBe(HASH);
  });
});

describe("buildVerificationStateRows", () => {
  it("composes verdicts with bindings: never supported without a bound span", () => {
    const { bindingByUnitId } = buildEvidenceRows({
      extractedUnits: [
        { id: "u1", evidence: "Every person's happiness counts equally in the aggregate." },
        { id: "u2", evidence: "nowhere quote" },
      ],
      storedUnits: [
        { id: "kg:aaa", localId: "u1", text: "t" },
        { id: "kg:bbb", localId: "u2", text: "t" },
      ],
      sourceText: SOURCE,
      sourceHash: HASH,
    });
    const { states, counts } = buildVerificationStateRows({
      verdicts: [
        { unitId: "kg:aaa", status: "ok" }, // bound + ok → supported
        { unitId: "kg:bbb", status: "ok" }, // unbound + ok → inferred
        { unitId: "kg:zzz", status: "ok" }, // no binding recorded → treated unbound → inferred
        { unitId: "kg:aaa", status: "weak" }, // weak → unverified, binding irrelevant
      ],
      bindingByUnitId,
      judgedBy: "openai:gpt-4o-mini",
    });
    expect(states.map((s) => s.state)).toEqual(["supported", "inferred", "inferred", "unverified"]);
    expect(counts.supported).toBe(1);
    expect(counts.inferred).toBe(2);
    expect(counts.unverified).toBe(1);
    expect(states[0].judgedBy).toBe("openai:gpt-4o-mini");
  });
});

describe("buildLayer2StateRows", () => {
  const META: EntailmentJudgeMeta = {
    model_id: "together:llama-3.3-70b",
    prompt_version: 1,
    judged_at: "2026-06-10T12:00:00.000Z",
    samples: 1,
  };

  it("composes entailment verdicts with bindings and emits audit judgments", () => {
    const { bindingByUnitId } = buildEvidenceRows({
      extractedUnits: [
        { id: "u1", evidence: "Every person's happiness counts equally in the aggregate." },
        { id: "u2", evidence: "nowhere quote" },
      ],
      storedUnits: [
        { id: "kg:aaa", localId: "u1", text: "t" },
        { id: "kg:bbb", localId: "u2", text: "t" },
      ],
      sourceText: SOURCE,
      sourceHash: HASH,
    });
    const out = buildLayer2StateRows({
      results: [
        { ref: "kg:aaa", verdict: "entailed", confidence: 0.9 },
        { ref: "kg:bbb", verdict: "entailed", confidence: 0.9 }, // unbound → inferred
        { ref: "kg:aaa", verdict: "entailed", confidence: 0.2 }, // low conf → unverified
        { ref: "kg:bbb", verdict: "not_entailed", confidence: 0.8 },
        { ref: "kg:aaa", verdict: "abstain", confidence: null, note: "coverage_gap" },
      ],
      bindingByUnitId,
      meta: META,
    });
    expect(out.states.map((s) => s.state)).toEqual([
      "supported",
      "inferred",
      "unverified",
      "unverified",
      "unverified",
    ]);
    expect(out.abstained).toEqual(["kg:aaa"]);
    expect(out.states[0]!.judgedBy).toBe("together:llama-3.3-70b#pv1");
    expect(out.judgments).toHaveLength(5);
    expect(out.judgments[0]).toMatchObject({
      unitId: "kg:aaa",
      verdict: "entailed",
      judgeModel: "together:llama-3.3-70b",
      promptVersion: 1,
      judgedAt: META.judged_at,
    });
    expect(out.judgments[4]).toMatchObject({ verdict: "abstain", note: "coverage_gap" });
  });
});
