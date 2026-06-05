import { describe, expect, it } from "vitest";
import { PHILOSOPHY_DOMAIN_PACK, DEFAULT_GENERIC_DOMAIN_PACK } from "@restormel/contracts/connect";
import {
  composeStageSystemPrompt,
  resolvePackArchetype,
  substitutePromptPlaceholders,
} from "../ingest/prompt-compose.js";

function hydrate(base: typeof PHILOSOPHY_DOMAIN_PACK) {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    workspace_id: "00000000-0000-4000-8000-000000000001",
    is_builtin: true,
    created_at: "2026-06-02T00:00:00.000Z",
    updated_at: "2026-06-02T00:00:00.000Z",
    ...base,
  };
}

describe("prompt-compose", () => {
  it("resolves philosophy archetype", () => {
    expect(resolvePackArchetype(hydrate(PHILOSOPHY_DOMAIN_PACK))).toBe("argumentative");
  });

  it("expands placeholders in custom overrides", () => {
    const pack = hydrate({
      ...DEFAULT_GENERIC_DOMAIN_PACK,
      prompts: { extraction: "Extract {unit_noun}s for {pack_title} using {unit_types}." },
    });
    const out = substitutePromptPlaceholders(pack.prompts.extraction!, pack);
    expect(out).toContain("statement");
    expect(out).toContain("Generic knowledge");
    expect(out).toContain("assertion");
  });

  it("injects passage_profile marker lexicon for philosophy extraction", () => {
    const sys = composeStageSystemPrompt({
      pack: hydrate(PHILOSOPHY_DOMAIN_PACK),
      stage: "extraction",
      qualityPreset: "production",
    });
    expect(sys).toContain("therefore");
    expect(sys).toContain("PRODUCTION CALIBRATION");
    expect(sys).toContain("STRICT JSON");
  });

  it("injects graph context for validation", () => {
    const sys = composeStageSystemPrompt({
      pack: hydrate(PHILOSOPHY_DOMAIN_PACK),
      stage: "validation",
      graphContext: {
        unitCount: 42,
        topUnitTypes: [{ type: "premise", count: 10 }],
        relationCount: 15,
        isGreenfield: false,
      },
    });
    expect(sys).toContain("42");
    expect(sys).toContain("premise");
  });
});
