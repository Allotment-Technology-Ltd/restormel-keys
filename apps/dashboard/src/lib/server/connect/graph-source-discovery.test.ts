/**
 * Shape/field-tolerant BYO source discovery.
 *
 * These tests drive discoverGraphSources against a mocked Surreal store + domain
 * pack to prove:
 *   - the owner's exact shape (table `source`; canonical_url / source_type / array
 *     author; title) is discovered with the right url/kind/author;
 *   - a hard read error is surfaced as scanError (never reported as "0 sources");
 *   - a 0-row scan with a high-confidence detectable candidate auto-applies on an
 *     editable pack and re-scans to find the sources;
 *   - candidateTables are populated when total === 0.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { DEFAULT_GENERIC_DOMAIN_PACK } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";

// ── Mocks ───────────────────────────────────────────────────────────────────

const targetMock = vi.fn();
const buildStoreMock = vi.fn();
const resolvePackMock = vi.fn();
const persistMappingMock = vi.fn();
const catalogCountMock = vi.fn();

vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetForWorkspace: (...a: unknown[]) => targetMock(...a),
  countGraphImportedCatalogSources: (...a: unknown[]) => catalogCountMock(...a),
  findConnectSourceDocumentText: vi.fn(),
  insertConnectSourceDocument: vi.fn(),
}));

vi.mock("./surreal-graph-store", () => ({
  buildWorkspaceGraphStore: (...a: unknown[]) => buildStoreMock(...a),
}));

vi.mock("./domain-pack-service", () => ({
  resolveWorkspaceDomainPack: (...a: unknown[]) => resolvePackMock(...a),
  persistDomainPackSourceTextMapping: (...a: unknown[]) => persistMappingMock(...a),
}));

import { discoverGraphSources } from "./graph-source-discovery";

const WS = "00000000-0000-4000-8000-000000000002";

function pack(schema: Partial<ConnectDomainPack["graph_schema"]> = {}, isBuiltin = false): ConnectDomainPack {
  return {
    id: "00000000-0000-4000-8000-0000000000bb",
    workspace_id: WS,
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
    is_builtin: isBuiltin,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

type StoreOpts = {
  tables: Record<string, Record<string, unknown>[]>;
  /** Table names that throw on SELECT * (simulate a read error / permission). */
  selectThrows?: Set<string>;
};

function mockStore(opts: StoreOpts): GraphStore {
  const infoTables: Record<string, string> = {};
  for (const name of Object.keys(opts.tables)) {
    infoTables[name] = `DEFINE TABLE ${name} SCHEMAFULL;`;
  }
  return {
    async query<T>(sql: string): Promise<T> {
      if (/INFO FOR DB/i.test(sql)) return [{ tables: infoTables }] as unknown as T;
      const countMatch = sql.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+GROUP ALL/i);
      if (countMatch) {
        const name = countMatch[1]!;
        return [{ count: opts.tables[name]?.length ?? 0 }] as unknown as T;
      }
      const selectStar = sql.match(/SELECT \* FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (selectStar) {
        const name = selectStar[1]!;
        if (opts.selectThrows?.has(name)) throw new Error("permission denied on " + name);
        return (opts.tables[name] ?? []) as unknown as T;
      }
      return [] as unknown as T;
    },
  } as unknown as GraphStore;
}

beforeEach(() => {
  vi.clearAllMocks();
  targetMock.mockResolvedValue({ provider: "surreal", status: "ok" });
  catalogCountMock.mockResolvedValue(0);
  persistMappingMock.mockResolvedValue(null);
});

describe("discoverGraphSources — owner's exact schema", () => {
  it("discovers the owner's source rows with correct url/kind/author", async () => {
    resolvePackMock.mockResolvedValue(pack());
    buildStoreMock.mockResolvedValue(
      mockStore({
        tables: {
          source: [
            {
              id: "source:1",
              title: "T",
              canonical_url: "https://x",
              source_type: "paper",
              author: ["A. Smith", "B. Jones"],
              // Inline full text under an unconventional field so the row resolves to "full".
              abstract: "y".repeat(300),
            },
          ],
        },
      }),
    );

    const result = await discoverGraphSources(WS);
    expect(result.total).toBe(1);
    const [src] = result.sources;
    expect(src.url).toBe("https://x");
    expect(src.kind).toBe("paper");
    expect(src.title).toBe("T");
    expect(src.author).toBe("A. Smith, B. Jones");
    expect(result.scanError).toBeNull();
    expect(result.sourceTableTried).toBe("source");
  });
});

describe("discoverGraphSources — never a false zero", () => {
  it("surfaces a read error as scanError instead of reporting 0 sources", async () => {
    resolvePackMock.mockResolvedValue(pack());
    buildStoreMock.mockResolvedValue(
      mockStore({ tables: { source: [{ id: "source:1", title: "T" }] }, selectThrows: new Set(["source"]) }),
    );

    const result = await discoverGraphSources(WS);
    expect(result.total).toBe(0);
    expect(result.scanError).toMatch(/permission denied/);
    expect(result.sourceTableTried).toBe("source");
    // A scanError must not be mislabelled as "needs manual mapping" / candidate path.
    expect(result.candidateTables).toBeUndefined();
  });

  it("populates candidateTables when the configured source table is empty", async () => {
    resolvePackMock.mockResolvedValue(pack({ source_table: "source" }));
    buildStoreMock.mockResolvedValue(
      mockStore({
        tables: {
          // configured "source" exists but is empty
          source: [],
          claim: [{ id: "claim:1" }],
          passage: [{ id: "passage:1" }],
          mydocs: [{ id: "mydocs:1" }, { id: "mydocs:2" }],
        },
      }),
    );

    const result = await discoverGraphSources(WS);
    expect(result.total).toBe(0);
    expect(result.candidateTables?.map((c) => c.name)).toContain("mydocs");
    expect(result.candidateTables?.map((c) => c.name)).not.toContain("claim");
  });

  it("auto-applies a high-confidence detection on an editable pack and re-scans", async () => {
    // Configured "source" is empty; the real sources live in "documents" with inline text.
    const editable = pack({ source_table: "source" }, false);
    resolvePackMock.mockResolvedValue(editable);
    const store = mockStore({
      tables: {
        source: [],
        documents: [
          { id: "documents:1", title: "Doc one", canonical_url: "https://d1", content: "lots of body text here" },
        ],
        claim: [{ id: "claim:1" }],
      },
    });
    buildStoreMock.mockResolvedValue(store);
    // persist applies the detected mapping → re-scan should now point at "documents".
    persistMappingMock.mockResolvedValue(pack({ source_table: "documents", source_text_field: "content" }, false));

    const result = await discoverGraphSources(WS);
    expect(result.packSynced).toBe(true);
    expect(result.total).toBe(1);
    expect(result.sources[0]?.url).toBe("https://d1");
    expect(result.sources[0]?.hasFullText).toBe(true);
  });
});
