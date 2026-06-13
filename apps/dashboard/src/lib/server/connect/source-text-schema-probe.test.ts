import { describe, expect, it } from "vitest";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import { DEFAULT_GENERIC_DOMAIN_PACK } from "@restormel/contracts/connect";
import {
  buildSourceTextPackSuggestion,
  detectInlineField,
  inferSourceTextSchemaPatch,
  isBibliographicSourceRow,
  isInvalidSourceTableMapping,
  isSourceTablePatchAllowed,
  listCandidateSourceTables,
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

const LONG = "x".repeat(300);

describe("isBibliographicSourceRow — recognise sources of any shape", () => {
  it("recognises the owner's source shape (title/canonical_url/source_type/author[])", () => {
    expect(
      isBibliographicSourceRow({
        id: "source:1",
        title: "T",
        canonical_url: "https://x",
        source_type: "paper",
        author: ["A. Smith", "B. Jones"],
      }),
    ).toBe(true);
  });

  it("recognises a row with only a synonym URL", () => {
    expect(isBibliographicSourceRow({ id: "source:2", link: "https://y" })).toBe(true);
  });

  it("recognises a row whose only signal is a long string field", () => {
    expect(isBibliographicSourceRow({ id: "doc:1", abstract: LONG })).toBe(true);
  });

  it("does not recognise an identity-less, text-less row", () => {
    expect(isBibliographicSourceRow({ id: "x:1", note: "short" })).toBe(false);
  });
});

describe("detectInlineField — conventional then long-string fallback", () => {
  it("finds a conventional inline field", () => {
    expect(detectInlineField({ id: "s:1", content: "body text" })).toBe("content");
  });

  it("falls back to any long non-identity string field", () => {
    expect(detectInlineField({ id: "s:1", abstract: LONG })).toBe("abstract");
  });

  it("ignores identity fields even when long", () => {
    expect(detectInlineField({ id: "s:1", canonical_url: "https://" + "a".repeat(300) })).toBeUndefined();
  });
});

function probePack(schema: Partial<ConnectDomainPack["graph_schema"]> = {}): ConnectDomainPack {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
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

/**
 * Minimal mock GraphStore. `tables` maps table name → its sample row(s); INFO FOR DB
 * is synthesised from the keys. count() returns the row array length.
 */
function mockStore(tables: Record<string, Record<string, unknown>[]>): GraphStore {
  const infoTables: Record<string, string> = {};
  for (const name of Object.keys(tables)) {
    infoTables[name] = `DEFINE TABLE ${name} SCHEMAFULL;`;
  }
  return {
    async query<T>(sql: string): Promise<T> {
      if (/INFO FOR DB/i.test(sql)) {
        return [{ tables: infoTables }] as unknown as T;
      }
      const countMatch = sql.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+GROUP ALL/i);
      if (countMatch) {
        const name = countMatch[1]!;
        return [{ count: tables[name]?.length ?? 0 }] as unknown as T;
      }
      const selectMatch = sql.match(/SELECT \* FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (selectMatch) {
        const name = selectMatch[1]!;
        return (tables[name] ?? []).slice(0, 1) as unknown as T;
      }
      // Passage lookups (no passage table in these fixtures) resolve to nothing.
      return [] as unknown as T;
    },
  } as unknown as GraphStore;
}

describe("inferSourceTextSchemaPatch — owner's shape resolves via inline long text", () => {
  it("resolves the owner's source row when full text lives under an unconventional field", async () => {
    const pack = probePack();
    const store = mockStore({
      source: [
        {
          id: "source:1",
          title: "T",
          canonical_url: "https://x",
          source_type: "paper",
          author: ["A. Smith", "B. Jones"],
          abstract: LONG,
        },
      ],
      claim: [{ id: "claim:1", text: "a claim" }],
    });
    const patch = await inferSourceTextSchemaPatch(store, pack);
    expect(patch?.source_table).toBe("source");
    // Full text is found under `abstract` via the long-string fallback.
    expect(patch?.source_text_field).toBe("abstract");
  });

  it("detects a documents table when sources have a conventional inline field", async () => {
    const pack = probePack({ source_table: "source" });
    const store = mockStore({
      documents: [{ id: "documents:1", name: "Doc", link: "https://d", content: "the body" }],
      claim: [{ id: "claim:1", text: "a claim" }],
    });
    const patch = await inferSourceTextSchemaPatch(store, pack);
    expect(patch?.source_table).toBe("documents");
    expect(patch?.source_text_field).toBe("content");
  });
});

describe("listCandidateSourceTables", () => {
  it("lists normal tables with rows, excluding unit/group/passage", async () => {
    const pack = probePack();
    const store = mockStore({
      claim: [{ id: "claim:1" }],
      argument: [{ id: "argument:1" }],
      passage: [{ id: "passage:1" }],
      mydocs: [{ id: "mydocs:1" }, { id: "mydocs:2" }],
      library: [{ id: "library:1" }],
    });
    const candidates = await listCandidateSourceTables(store, pack);
    const names = candidates.map((c) => c.name);
    expect(names).toContain("mydocs");
    expect(names).toContain("library");
    expect(names).not.toContain("claim");
    expect(names).not.toContain("argument");
    expect(names).not.toContain("passage");
    expect(candidates.find((c) => c.name === "mydocs")?.count).toBe(2);
  });
});
