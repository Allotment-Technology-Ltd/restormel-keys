import { describe, expect, it } from "vitest";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { DEFAULT_GENERIC_DOMAIN_PACK } from "@restormel/contracts/connect";
import {
  buildSourceTextPackSuggestion,
  isInvalidSourceTableMapping,
  isSourceTablePatchAllowed,
  patchesEqual,
  type SourceTextSchemaPatch,
} from "./source-text-schema-probe";

function basePack(schema: Partial<ConnectDomainPack["graph_schema"]> = {}): ConnectDomainPack {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    workspace_id: "00000000-0000-4000-8000-000000000002",
    slug: "custom-surreal",
    title: "Custom Surreal",
    quality_preset: "production",
    cross_model_validation: true,
    ontology: DEFAULT_GENERIC_DOMAIN_PACK.ontology,
    prompts: {},
    graph_schema: {
      source_table: "source",
      passage_table: "passage",
      unit_table: "claim",
      group_table: "argument",
      part_of_edge: "part_of",
      relation_edges: [],
      unit_vector_field: "embedding",
      ...schema,
    },
    passage_profile: DEFAULT_GENERIC_DOMAIN_PACK.passage_profile,
    embedding: DEFAULT_GENERIC_DOMAIN_PACK.embedding,
    is_builtin: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("buildSourceTextPackSuggestion", () => {
  it("returns null when mapping is unchanged", () => {
    const pack = basePack();
    const suggested: SourceTextSchemaPatch = {
      source_table: "source",
      passage_table: "passage",
    };
    expect(
      buildSourceTextPackSuggestion({
        pack,
        suggested,
        confidence: "high",
        reason: "test",
      }),
    ).toBeNull();
  });

  it("lists table changes for custom packs", () => {
    const pack = basePack({ source_table: "wrong_source", passage_table: "wrong_passage" });
    const suggestion = buildSourceTextPackSuggestion({
      pack,
      suggested: { source_table: "source", passage_table: "passage" },
      confidence: "high",
      reason: "Detected SOPHIA-style tables.",
    });
    expect(suggestion?.canAutoApply).toBe(true);
    expect(suggestion?.changes).toEqual(
      expect.arrayContaining([
        "source_table: wrong_source → source",
        "passage_table: wrong_passage → passage",
      ]),
    );
  });

  it("blocks auto-apply on builtin packs", () => {
    const pack = { ...basePack(), is_builtin: true };
    const suggestion = buildSourceTextPackSuggestion({
      pack,
      suggested: { source_table: "sources", passage_table: "passage" },
      confidence: "high",
      reason: "Wrong source table.",
    });
    expect(suggestion?.canAutoApply).toBe(false);
  });
});

describe("isInvalidSourceTableMapping", () => {
  it("flags when source_table equals unit_table", () => {
    expect(isInvalidSourceTableMapping(basePack({ source_table: "claim" }))).toBe(true);
  });

  it("accepts separate source and unit tables", () => {
    expect(isInvalidSourceTableMapping(basePack())).toBe(false);
  });
});

describe("isSourceTablePatchAllowed", () => {
  it("rejects patching source_table to the unit table", () => {
    const pack = basePack();
    expect(isSourceTablePatchAllowed(pack, { source_table: "claim", passage_table: "passage" })).toBe(
      false,
    );
  });
});

describe("patchesEqual", () => {
  it("compares normalized mapping patches", () => {
    expect(
      patchesEqual(
        { source_table: "source", passage_table: "passage" },
        { source_table: "source", passage_table: "passage" },
      ),
    ).toBe(true);
    expect(
      patchesEqual(
        { source_table: "source", passage_table: "passage" },
        { source_table: "sources", passage_table: "passage" },
      ),
    ).toBe(false);
  });
});
