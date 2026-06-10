/**
 * H1 + H3 (docs/reviews/connect-ingest-context.md §6, Stage 1.4):
 * - H1: loose-JSON parsers signal "parse failed / batch lost"; lost batches are
 *   re-asked exactly once before fail-safe coverage defaults apply.
 * - H3: the extraction gate acts on orphan/dangling/no_relations thresholds
 *   (preset-driven: production blocks, starter warns) and strict pattern
 *   violations now block instead of allowing persist with a blocking reason.
 */
import { describe, expect, it } from "vitest";
import {
  askBatchWithCoverageRetry,
  omittedBatchRefs,
  type BatchCoverageShortfall,
} from "../ingest/batch-coverage.js";
import {
  parseValidationResponseDetailed,
  validateUnits,
} from "../ingest/validation.js";
import {
  parseRemediationResponseDetailed,
  remediateUnits,
} from "../ingest/remediation.js";
import { parseEntailmentResponseDetailed, judgeEntailment } from "../ingest/entailment.js";
import {
  evaluateExtractionGate,
  EXTRACTION_GATE_THRESHOLDS,
} from "../ingest/extraction-gates.js";
import type { ExtractionWarning } from "../ingest/extract.js";
import { DEFAULT_GENERIC_DOMAIN_PACK, type ConnectDomainPack } from "@restormel/contracts/connect";

const PACK: ConnectDomainPack = {
  ...DEFAULT_GENERIC_DOMAIN_PACK,
  id: "00000000-0000-4000-8000-000000000001",
  workspace_id: "00000000-0000-4000-8000-000000000002",
  quality_preset: "production",
  cross_model_validation: true,
  prompts: {},
  is_builtin: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
} as ConnectDomainPack;

/** The H1 repro fixture: a response truncated mid-array (max_tokens / network cut). */
const TRUNCATED =
  '{"results":[{"ref":"v1","status":"ok"},{"ref":"v2","status":"unsupported"},{"ref":"v3","stat';

describe("H1 — detailed parsers signal parse failure", () => {
  it("validation: truncated output → parseFailed true, zero results", () => {
    const out = parseValidationResponseDetailed(TRUNCATED);
    expect(out.parseFailed).toBe(true);
    expect(out.results).toEqual([]);
  });

  it("validation: clean and prose-wrapped output → parseFailed false", () => {
    const clean = parseValidationResponseDetailed('{"results":[{"ref":"v1","status":"ok"}]}');
    expect(clean.parseFailed).toBe(false);
    expect(clean.results).toHaveLength(1);
    const wrapped = parseValidationResponseDetailed(
      'Sure! {"results":[{"ref":"v1","status":"weak"}]} hope that helps',
    );
    expect(wrapped.parseFailed).toBe(false);
    expect(wrapped.results[0]).toMatchObject({ ref: "v1", status: "weak" });
  });

  it("remediation + entailment parsers carry the same signal", () => {
    expect(parseRemediationResponseDetailed("total garbage").parseFailed).toBe(true);
    expect(
      parseRemediationResponseDetailed('{"results":[{"ref":"r1","action":"drop"}]}'),
    ).toMatchObject({ parseFailed: false });
    expect(parseEntailmentResponseDetailed(TRUNCATED).parseFailed).toBe(true);
    expect(
      parseEntailmentResponseDetailed('{"results":[{"ref":"e1","verdict":"entailed"}]}'),
    ).toMatchObject({ parseFailed: false });
  });
});

describe("H1 — askBatchWithCoverageRetry", () => {
  it("omittedBatchRefs ignores unknown refs and finds the gaps", () => {
    expect(
      omittedBatchRefs([{ ref: "a" }, { ref: "b" }], [{ ref: "b" }, { ref: "zz" }]),
    ).toEqual(["a"]);
  });

  it("full coverage on the first ask: no shortfall, no retry", async () => {
    let asks = 0;
    const out = await askBatchWithCoverageRetry({
      inputs: [{ ref: "a" }, { ref: "b" }],
      ask: async (units) => {
        asks += 1;
        return { results: units.map((u) => ({ ref: u.ref })), parseFailed: false };
      },
      onShortfall: () => {
        throw new Error("must not be called");
      },
    });
    expect(asks).toBe(1);
    expect(out).toMatchObject({ reasked: false, omittedRefs: [], parseFailed: false });
  });

  it("lost batch: reports the shortfall and re-asks the omitted refs exactly once", async () => {
    const askedWith: string[][] = [];
    const shortfalls: BatchCoverageShortfall[] = [];
    const out = await askBatchWithCoverageRetry({
      inputs: [{ ref: "a" }, { ref: "b" }, { ref: "c" }],
      ask: async (units) => {
        askedWith.push(units.map((u) => u.ref));
        // First ask: unparseable (whole batch lost). Retry: returns b + c only.
        if (askedWith.length === 1) return { results: [], parseFailed: true };
        return {
          results: [{ ref: "b" }, { ref: "c" }],
          parseFailed: false,
        };
      },
      onShortfall: (info) => {
        shortfalls.push(info);
      },
    });
    expect(askedWith).toEqual([["a", "b", "c"], ["a", "b", "c"]]);
    expect(shortfalls).toEqual([{ omittedRefs: ["a", "b", "c"], parseFailed: true }]);
    // No second retry: "a" stays omitted for the caller's fail-safe finalize.
    expect(out.omittedRefs).toEqual(["a"]);
    expect(out.reasked).toBe(true);
    expect(out.results.map((r) => r.ref).sort()).toEqual(["b", "c"]);
  });

  it("partial first answer: only the omitted refs are re-asked, first answers win", async () => {
    const askedWith: string[][] = [];
    const out = await askBatchWithCoverageRetry<
      { ref: string },
      { ref: string; status: string }
    >({
      inputs: [{ ref: "a" }, { ref: "b" }],
      ask: async (units) => {
        askedWith.push(units.map((u) => u.ref));
        if (askedWith.length === 1) {
          return { results: [{ ref: "a", status: "ok" }], parseFailed: false };
        }
        return {
          results: [
            { ref: "a", status: "weak" }, // must NOT overwrite the first answer
            { ref: "b", status: "unsupported" },
          ],
          parseFailed: false,
        };
      },
    });
    expect(askedWith[1]).toEqual(["b"]);
    const byRef = new Map(out.results.map((r) => [r.ref, r.status]));
    expect(byRef.get("a")).toBe("ok");
    expect(byRef.get("b")).toBe("unsupported");
    expect(out.omittedRefs).toEqual([]);
  });
});

describe("H1 — stage functions re-ask once before fail-safe defaults", () => {
  it("validateUnits: truncated first response → re-ask recovers; leftovers finalize weak", async () => {
    let calls = 0;
    const results = await validateUnits({
      units: [
        { ref: "unit:1", text: "t1" },
        { ref: "unit:2", text: "t2" },
        { ref: "unit:3", text: "t3" },
      ],
      sourceText: "src",
      pack: PACK,
      generate: async () => {
        calls += 1;
        if (calls === 1) return TRUNCATED;
        // Retry answers v1 + v2 but still omits v3.
        return '{"results":[{"ref":"v1","status":"ok"},{"ref":"v2","status":"unsupported"}]}';
      },
    });
    expect(calls).toBe(2);
    const byRef = new Map(results.map((r) => [r.ref, r]));
    expect(byRef.get("unit:1")).toMatchObject({ status: "ok" });
    expect(byRef.get("unit:2")).toMatchObject({ status: "unsupported" });
    expect(byRef.get("unit:3")!.status).toBe("weak");
    expect(byRef.get("unit:3")!.note).toContain("coverage_gap");
  });

  it("remediateUnits: lost batch is re-asked once; leftovers finalize drop", async () => {
    let calls = 0;
    const shortfalls: BatchCoverageShortfall[] = [];
    const results = await remediateUnits({
      units: [
        { ref: "unit:1", text: "t1" },
        { ref: "unit:2", text: "t2" },
      ],
      sourceText: "src",
      pack: PACK,
      generate: async () => {
        calls += 1;
        if (calls === 1) return "garbled }} not json";
        return '{"results":[{"ref":"r1","action":"repair","text":"fixed","confidence":0.9}]}';
      },
      onCoverageShortfall: (info) => {
        shortfalls.push(info);
      },
    });
    expect(calls).toBe(2);
    expect(shortfalls).toHaveLength(1);
    expect(shortfalls[0]).toMatchObject({ parseFailed: true });
    const byRef = new Map(results.map((r) => [r.ref, r]));
    expect(byRef.get("unit:1")).toMatchObject({ action: "repair", text: "fixed" });
    expect(byRef.get("unit:2")).toMatchObject({ action: "drop" });
  });

  it("judgeEntailment: lost batch is re-asked once; leftovers abstain (coverage_gap)", async () => {
    let calls = 0;
    const shortfalls: BatchCoverageShortfall[] = [];
    const { results } = await judgeEntailment({
      inputs: [
        { ref: "unit:1", claim: "c1", spans: ["q1"] },
        { ref: "unit:2", claim: "c2", spans: ["q2"] },
      ],
      generate: async () => {
        calls += 1;
        if (calls === 1) return TRUNCATED;
        return '{"results":[{"ref":"e1","verdict":"entailed","confidence":0.9}]}';
      },
      onCoverageShortfall: (info) => {
        shortfalls.push(info);
      },
    });
    expect(calls).toBe(2);
    expect(shortfalls).toHaveLength(1);
    expect(shortfalls[0]!.parseFailed).toBe(true);
    const byRef = new Map(results.map((r) => [r.ref, r]));
    // Refs were sorted by span before batching; e1 maps to the q1 claim.
    expect(byRef.get("unit:1")).toMatchObject({ verdict: "entailed" });
    expect(byRef.get("unit:2")!.verdict).toBe("abstain");
    expect(byRef.get("unit:2")!.note).toContain("coverage_gap");
  });
});

function warn(code: ExtractionWarning["code"], count?: number): ExtractionWarning {
  return { code, severity: "warning", message: code, ...(count != null ? { count } : {}) };
}

describe("H3 — evaluateExtractionGate orphan/dangling/no_relations thresholds", () => {
  it("preset thresholds: production blocks, starter warns", () => {
    expect(EXTRACTION_GATE_THRESHOLDS.production.mode).toBe("block");
    expect(EXTRACTION_GATE_THRESHOLDS.starter.mode).toBe("warn");
  });

  it("production blocks an all-orphan chunk (no_relations counts as all orphaned)", () => {
    const gate = evaluateExtractionGate([warn("no_relations")], "production", "guided", {
      totals: { units: 5, relations: 0 },
    });
    expect(gate.allowPersist).toBe(false);
    expect(gate.breaches).toEqual(["orphan_units:5/5"]);
  });

  it("production blocks above the orphan ratio, allows at or below it", () => {
    const blocked = evaluateExtractionGate([warn("orphan_units", 5)], "production", "guided", {
      totals: { units: 5, relations: 2 },
    });
    expect(blocked.allowPersist).toBe(false);
    const allowed = evaluateExtractionGate([warn("orphan_units", 4)], "production", "guided", {
      totals: { units: 5, relations: 2 },
    });
    expect(allowed.allowPersist).toBe(true);
    expect(allowed.breaches).toBeUndefined();
  });

  it("tiny chunks are exempt from the orphan gate (orphanGateMinUnits)", () => {
    const gate = evaluateExtractionGate([warn("no_relations")], "production", "guided", {
      totals: { units: 2, relations: 0 },
    });
    expect(gate.allowPersist).toBe(true);
  });

  it("production blocks when the dangling-relation ratio is breached", () => {
    const gate = evaluateExtractionGate([warn("dangling_relation", 3)], "production", "guided", {
      totals: { units: 10, relations: 4 },
    });
    expect(gate.allowPersist).toBe(false);
    expect(gate.breaches).toEqual(["dangling_relation:3/4"]);
  });

  it("starter warns instead of blocking (breaches surfaced, persist allowed)", () => {
    const gate = evaluateExtractionGate(
      [warn("orphan_units", 5), warn("dangling_relation", 3)],
      "starter",
      "guided",
      { totals: { units: 5, relations: 4 } },
    );
    expect(gate.allowPersist).toBe(true);
    expect(gate.breaches).toEqual(["orphan_units:5/5", "dangling_relation:3/4"]);
  });

  it("strict pattern_violation now BLOCKS under production (contradiction resolved)", () => {
    const gate = evaluateExtractionGate([warn("pattern_violation", 2)], "production", "strict", {
      totals: { units: 5, relations: 5 },
    });
    expect(gate.allowPersist).toBe(false);
    expect(gate.reason).toBe("pattern_violation:2");
    // guided mode never pattern-gates; starter only warns.
    expect(
      evaluateExtractionGate([warn("pattern_violation", 2)], "production", "guided").allowPersist,
    ).toBe(true);
    expect(
      evaluateExtractionGate([warn("pattern_violation", 2)], "starter", "strict").allowPersist,
    ).toBe(true);
  });

  it("legacy 3-arg call keeps its contract (no totals → no ratio gates)", () => {
    const gate = evaluateExtractionGate(
      [warn("no_relations"), warn("dangling_relation", 9)],
      "production",
      "guided",
    );
    expect(gate.allowPersist).toBe(true);
    expect(evaluateExtractionGate([warn("no_units")], "production", "guided").allowPersist).toBe(
      false,
    );
  });

  it("caller-supplied threshold overrides win over the preset", () => {
    const gate = evaluateExtractionGate([warn("orphan_units", 2)], "production", "guided", {
      totals: { units: 10, relations: 5 },
      thresholds: { maxOrphanUnitRatio: 0.1 },
    });
    expect(gate.allowPersist).toBe(false);
    expect(gate.breaches).toEqual(["orphan_units:2/10"]);
  });
});
