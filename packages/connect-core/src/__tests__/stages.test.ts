import { describe, expect, it } from "vitest";
import {
  buildGroupingSystemPrompt,
  parseGroupingResponse,
  buildValidationSystemPrompt,
  parseValidationResponse,
  buildRemediationSystemPrompt,
  parseRemediationResponse,
  shouldRunStage,
  CONNECT_STAGE_ORDER,
} from "../index.js";
import { PHILOSOPHY_DOMAIN_PACK } from "@restormel/contracts/connect";

function hydrate(base: typeof PHILOSOPHY_DOMAIN_PACK) {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    workspace_id: "00000000-0000-4000-8000-000000000001",
    is_builtin: false,
    created_at: "2026-06-02T00:00:00.000Z",
    updated_at: "2026-06-02T00:00:00.000Z",
    ...base,
    prompts: base.prompts ?? {},
  } as Parameters<typeof buildGroupingSystemPrompt>[0];
}

describe("grouping", () => {
  it("prompt injects group roles and JSON contract", () => {
    const sys = buildGroupingSystemPrompt(hydrate(PHILOSOPHY_DOMAIN_PACK));
    expect(sys).toContain("argument"); // group_noun
    expect(sys).toContain("role from:");
    expect(sys).toContain("STRICT JSON");
  });
  it("parses groups + members, dropping memberless groups", () => {
    const out = parseGroupingResponse(
      '{"groups":[{"name":"G1","summary":"s","members":[{"ref":"u1","role":"premise"},{"ref":"u2"}]},{"name":"Empty","members":[]}]}',
    );
    expect(out).toHaveLength(1);
    expect(out[0].members).toHaveLength(2);
    expect(out[0].members[0].role).toBe("premise");
  });
});

describe("validation", () => {
  it("prompt explains statuses + JSON", () => {
    const sys = buildValidationSystemPrompt(hydrate(PHILOSOPHY_DOMAIN_PACK));
    expect(sys).toContain("unsupported");
    expect(sys).toContain("STRICT JSON");
    expect(sys).toContain("Calibrate toward");
  });
  it("parses results and defaults bad status to weak", () => {
    const out = parseValidationResponse('{"results":[{"ref":"u1","status":"ok"},{"ref":"u2","status":"???"}]}');
    expect(out).toEqual([
      { ref: "u1", status: "ok" },
      { ref: "u2", status: "weak" },
    ]);
  });
  it("batches short refs and fails omitted units safe as weak (coverage gap)", async () => {
    const { buildValidationBatchInputs, finalizeValidationCoverage, remapValidationBatchResults } =
      await import("../ingest/validation.js");
    const units = [
      { ref: "claim:aaa", text: "A" },
      { ref: "claim:bbb", text: "B" },
    ];
    const batches = buildValidationBatchInputs(units);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.batchUnits[0]?.ref).toBe("v1");
    const remapped = remapValidationBatchResults([{ ref: "v1", status: "weak", note: "vague" }], batches[0]!.refToUnitId);
    expect(remapped[0]?.ref).toBe("claim:aaa");
    const finalized = finalizeValidationCoverage(units, remapped);
    expect(finalized).toEqual([
      { ref: "claim:aaa", status: "weak", note: "vague" },
      { ref: "claim:bbb", status: "weak", note: "coverage_gap: validator omitted this unit" },
    ]);
  });
  it("leaves model-judged verdicts untouched when coverage is complete", async () => {
    const { finalizeValidationCoverage } = await import("../ingest/validation.js");
    const units = [
      { ref: "claim:aaa", text: "A" },
      { ref: "claim:bbb", text: "B" },
      { ref: "claim:ccc", text: "C" },
    ];
    const judged = [
      { ref: "claim:aaa", status: "ok" as const },
      { ref: "claim:bbb", status: "weak" as const, note: "vague" },
      { ref: "claim:ccc", status: "unsupported" as const },
    ];
    expect(finalizeValidationCoverage(units, judged)).toEqual(judged);
  });
});

describe("remediation", () => {
  it("prompt explains repair/drop/keep + JSON", () => {
    const sys = buildRemediationSystemPrompt(hydrate(PHILOSOPHY_DOMAIN_PACK));
    expect(sys).toContain("repair");
    expect(sys).toContain("drop");
    expect(sys).toContain("STRICT JSON");
    expect(sys).toContain("do not omit units");
  });
  it("parses results, keeping repair text only for repairs", () => {
    const out = parseRemediationResponse(
      '{"results":[{"ref":"u1","action":"repair","text":"fixed"},{"ref":"u2","action":"drop","text":"ignored"},{"ref":"u3","action":"keep"}]}',
    );
    expect(out).toEqual([
      { ref: "u1", action: "repair", text: "fixed" },
      { ref: "u2", action: "drop" },
      { ref: "u3", action: "keep" },
    ]);
  });
  it("batches short refs and fails omitted units safe as drop (not keep)", async () => {
    const { buildRemediationBatchInputs, finalizeRemediationCoverage, remapRemediationBatchResults } =
      await import("../ingest/remediation.js");
    const units = [
      { ref: "claim:aaa", text: "A", note: "weak" },
      { ref: "claim:bbb", text: "B", note: "unsupported" },
    ];
    const batches = buildRemediationBatchInputs(units);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.batchUnits[0]?.ref).toBe("r1");
    const remapped = remapRemediationBatchResults(
      [{ ref: "r1", action: "repair", text: "fixed A" }],
      batches[0]!.refToUnitId,
    );
    expect(remapped[0]?.ref).toBe("claim:aaa");
    const finalized = finalizeRemediationCoverage(units, remapped);
    expect(finalized).toEqual([
      { ref: "claim:aaa", action: "repair", text: "fixed A" },
      { ref: "claim:bbb", action: "drop" },
    ]);
  });
  it("leaves model-judged actions untouched when coverage is complete", async () => {
    const { finalizeRemediationCoverage } = await import("../ingest/remediation.js");
    const units = [
      { ref: "claim:aaa", text: "A", note: "weak" },
      { ref: "claim:bbb", text: "B", note: "unsupported" },
    ];
    const judged = [
      { ref: "claim:aaa", action: "keep" as const, confidence: 0.9 },
      { ref: "claim:bbb", action: "drop" as const, confidence: 0.8 },
    ];
    expect(finalizeRemediationCoverage(units, judged)).toEqual(judged);
  });
  it("splits large weak-unit sets into multiple batches", async () => {
    const { buildRemediationBatchInputs, REMEDIATION_BATCH_SIZE } = await import("../ingest/remediation.js");
    const units = Array.from({ length: REMEDIATION_BATCH_SIZE + 3 }, (_, i) => ({
      ref: `claim:${i}`,
      text: `unit ${i}`,
    }));
    const batches = buildRemediationBatchInputs(units);
    expect(batches).toHaveLength(2);
    expect(batches[0]?.batchUnits).toHaveLength(REMEDIATION_BATCH_SIZE);
    expect(batches[1]?.batchUnits).toHaveLength(3);
  });
});

describe("shouldRunStage", () => {
  it("runs all stages when no stop set", () => {
    for (const s of CONNECT_STAGE_ORDER) expect(shouldRunStage(s)).toBe(true);
  });
  it("respects stop_after_stage", () => {
    expect(shouldRunStage("embedding", "grouping")).toBe(false);
    expect(shouldRunStage("grouping", "grouping")).toBe(true);
    expect(shouldRunStage("relating", "grouping")).toBe(true);
    expect(shouldRunStage("validating", "embedding")).toBe(false);
  });
});
