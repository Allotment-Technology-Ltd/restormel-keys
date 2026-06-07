import { describe, expect, it, vi } from "vitest";
import type { GraphStore } from "@restormel/graphrag-core";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { DEFAULT_GENERIC_DOMAIN_PACK } from "@restormel/contracts/connect";
import {
  extractInlineSourceText,
  fetchPassageTextForSource,
  resolveSurrealSourceFullText,
} from "./surreal-source-text";

function sophiaPack(overrides?: Partial<ConnectDomainPack["graph_schema"]>): ConnectDomainPack {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    workspace_id: "00000000-0000-4000-8000-000000000002",
    slug: "claim-surreal",
    title: "SOPHIA import",
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
      relation_edges: ["supports"],
      unit_vector_field: "embedding",
      ...overrides,
    },
    passage_profile: DEFAULT_GENERIC_DOMAIN_PACK.passage_profile,
    embedding: DEFAULT_GENERIC_DOMAIN_PACK.embedding,
    is_builtin: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function fakeStore(query: GraphStore["query"]): GraphStore {
  return { query, isDatabaseUnavailable: () => false } as unknown as GraphStore;
}

describe("extractInlineSourceText", () => {
  it("reads body when text is absent", () => {
    expect(extractInlineSourceText({ body: "  full doc  " })).toBe("full doc");
  });

  it("honours configured source_text_field override", () => {
    expect(
      extractInlineSourceText({ raw_text: "from override", text: "ignored" }, "raw_text"),
    ).toBe("from override");
  });
});

describe("resolveSurrealSourceFullText", () => {
  it("returns inline text without querying passages", async () => {
    const store = fakeStore(vi.fn() as GraphStore["query"]);
    const resolved = await resolveSurrealSourceFullText({
      store,
      pack: sophiaPack(),
      sourceRow: { id: "source:abc", title: "T", text: "inline body" },
      sourceId: "source:abc",
    });
    expect(resolved).toMatchObject({
      text: "inline body",
      quality: "full",
      origin: "inline",
    });
    expect(store.query).not.toHaveBeenCalled();
  });

  it("aggregates passage rows when source record is metadata-only", async () => {
    const store = fakeStore(
      vi.fn(async (sql: string) => {
        if (sql.includes("FROM passage") && sql.includes("type::record")) {
          return [{ text: "Passage one" }, { text: "Passage two" }];
        }
        return [];
      }) as GraphStore["query"],
    );
    const resolved = await resolveSurrealSourceFullText({
      store,
      pack: sophiaPack(),
      sourceRow: { id: "source:ethics-1", title: "Ethics", url: "https://example.com" },
      sourceId: "source:ethics-1",
    });
    expect(resolved).toMatchObject({
      text: "Passage one\n\nPassage two",
      quality: "full",
      origin: "passage",
      passageCount: 2,
    });
  });

  it("falls back to preview when no full text exists", async () => {
    const store = fakeStore(vi.fn(async () => []) as GraphStore["query"]);
    const resolved = await resolveSurrealSourceFullText({
      store,
      pack: sophiaPack(),
      sourceRow: { id: "source:x", text_preview: "Short preview" },
      sourceId: "source:x",
    });
    expect(resolved).toMatchObject({
      text: "Short preview",
      quality: "preview",
      origin: "preview_only",
    });
  });

  it("returns missing when neither inline nor passage text exists", async () => {
    const store = fakeStore(vi.fn(async () => []) as GraphStore["query"]);
    const resolved = await resolveSurrealSourceFullText({
      store,
      pack: sophiaPack(),
      sourceRow: { id: "source:empty", title: "No text" },
      sourceId: "source:empty",
    });
    expect(resolved).toMatchObject({ text: "", quality: "missing", origin: "none" });
  });
});

describe("fetchPassageTextForSource", () => {
  it("uses full record id when type::record query returns nothing", async () => {
    const store = fakeStore(
      vi.fn(async (sql: string) => {
        if (sql.includes("type::record")) return [];
        if (sql.includes("source:legacy")) return [{ text: "Legacy passage" }];
        return [];
      }) as GraphStore["query"],
    );
    const result = await fetchPassageTextForSource(store, sophiaPack(), "source:legacy");
    expect(result).toEqual({ text: "Legacy passage", passageCount: 1 });
  });

  it("orders by order_in_source for SOPHIA-shaped passage rows", async () => {
    const store = fakeStore(
      vi.fn(async (sql: string) => {
        if (sql.includes("ORDER BY chunk_index")) {
          throw new Error("Unknown field `chunk_index`");
        }
        if (sql.includes("order_in_source") && sql.includes("source:n4kqcpjkgq6oiy1hpyxo")) {
          return [
            { text: "Passage one" },
            { text: "Passage two" },
          ];
        }
        return [];
      }) as GraphStore["query"],
    );
    const result = await fetchPassageTextForSource(
      store,
      sophiaPack(),
      "source:n4kqcpjkgq6oiy1hpyxo",
    );
    expect(result).toEqual({
      text: "Passage one\n\nPassage two",
      passageCount: 2,
    });
  });
});
