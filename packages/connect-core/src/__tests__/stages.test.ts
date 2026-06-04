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
  it("batches short refs and fills omitted units as ok", async () => {
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
      { ref: "claim:bbb", status: "ok", note: "Assumed supported (validator omitted this unit)" },
    ]);
  });
});

describe("remediation", () => {
  it("prompt explains repair/drop/keep + JSON", () => {
    const sys = buildRemediationSystemPrompt(hydrate(PHILOSOPHY_DOMAIN_PACK));
    expect(sys).toContain("repair");
    expect(sys).toContain("drop");
    expect(sys).toContain("STRICT JSON");
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
