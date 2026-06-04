import { describe, expect, it } from "vitest";
import {
  analyzeExtraction,
  buildExtractionSystemPrompt,
  extractGraph,
  parseExtractionResponse,
  type ExtractionGenerate,
} from "../index.js";
import { DEFAULT_GENERIC_DOMAIN_PACK, PHILOSOPHY_DOMAIN_PACK } from "@restormel/contracts/connect";

// Hydrate upsert literals into full packs (add id/workspace/timestamps).
function pack(base: typeof DEFAULT_GENERIC_DOMAIN_PACK, overrides?: Partial<{ schema_mode: "strict" | "guided" | "open" }>) {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    workspace_id: "00000000-0000-4000-8000-000000000001",
    is_builtin: false,
    created_at: "2026-06-02T00:00:00.000Z",
    updated_at: "2026-06-02T00:00:00.000Z",
    ...base,
    prompts: base.prompts ?? {},
    ontology: { ...base.ontology, ...(overrides ?? {}) },
  } as Parameters<typeof analyzeExtraction>[2];
}

describe("buildExtractionSystemPrompt", () => {
  it("injects relation types, patterns, and schema mode", () => {
    const sys = buildExtractionSystemPrompt(pack(PHILOSOPHY_DOMAIN_PACK, { schema_mode: "strict" }));
    expect(sys).toContain("Relation types:");
    expect(sys).toContain("Allowed relationship patterns");
    expect(sys).toContain("STRICT MODE");
    expect(sys).toContain("STRICT JSON");
  });

  it("uses a prompt override when present", () => {
    const base = { ...DEFAULT_GENERIC_DOMAIN_PACK, prompts: { extraction: "CUSTOM SYSTEM PROMPT" } };
    expect(buildExtractionSystemPrompt(pack(base))).toContain("CUSTOM SYSTEM PROMPT");
  });
});

describe("parseExtractionResponse", () => {
  it("parses units and relations, tolerating surrounding prose", () => {
    const raw = 'Here:\n{"units":[{"id":"u1","text":"A","type":"assertion"},{"id":"u2","text":"B"}],"relations":[{"from":"u1","relation":"supports","to":"u2"}]}';
    const out = parseExtractionResponse(raw);
    expect(out.units).toHaveLength(2);
    expect(out.relations).toEqual([{ from: "u1", relation: "supports", to: "u2" }]);
  });

  it("drops empty units and malformed relations", () => {
    const out = parseExtractionResponse('{"units":[{"id":"u1","text":""},{"id":"u2","text":"ok"}],"relations":[{"from":"u2"}]}');
    expect(out.units).toHaveLength(1);
    expect(out.relations).toHaveLength(0);
  });
});

describe("analyzeExtraction", () => {
  it("flags orphans and disconnected graphs", () => {
    const p = pack(DEFAULT_GENERIC_DOMAIN_PACK);
    const noRel = analyzeExtraction([{ id: "u1", text: "x" }], [], p);
    expect(noRel.some((w) => w.code === "no_relations")).toBe(true);

    const orphan = analyzeExtraction(
      [{ id: "u1", text: "a" }, { id: "u2", text: "b" }, { id: "u3", text: "c" }],
      [{ from: "u1", relation: "relates_to", to: "u2" }],
      p,
    );
    expect(orphan.find((w) => w.code === "orphan_units")?.count).toBe(1);
  });

  it("flags pattern violations in strict mode", () => {
    const p = pack(PHILOSOPHY_DOMAIN_PACK, { schema_mode: "strict" });
    const warnings = analyzeExtraction(
      [{ id: "u1", text: "a", type: "objection" }, { id: "u2", text: "b", type: "conclusion" }],
      [{ from: "u1", relation: "supports", to: "u2" }], // objection-supports-conclusion is not an allowed pattern
      p,
    );
    expect(warnings.some((w) => w.code === "pattern_violation")).toBe(true);
  });
});

describe("extractGraph (DI)", () => {
  it("composes prompt, parses, and analyzes", async () => {
    const generate: ExtractionGenerate = async ({ system }) => {
      expect(system).toContain("STRICT JSON");
      return '{"units":[{"id":"u1","text":"Earth orbits the Sun.","type":"assertion"}],"relations":[]}';
    };
    const res = await extractGraph({ text: "Some text", pack: pack(DEFAULT_GENERIC_DOMAIN_PACK), generate });
    expect(res.units).toHaveLength(1);
    expect(res.warnings.some((w) => w.code === "no_relations")).toBe(true);
  });
});
