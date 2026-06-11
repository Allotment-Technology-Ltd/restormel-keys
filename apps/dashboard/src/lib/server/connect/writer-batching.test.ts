/**
 * Writer batching phase 2 (Stage 1.9):
 * 1. Postgres storeExtractedGraphPostgres uses a single batch INSERT per call (order-preserving).
 * 2. Surreal setEvidence / setVerificationStates / recordJudgments / writeUnitsAndRelations each
 *    issue ONE store.query round-trip, with per-record read-back verification intact.
 *
 * Round-trip counts are measured by intercepting store.query calls on a mock store or
 * the neon sql-tag; the counts reported here reflect a 300-unit source:
 *   Before: 3 calls × 300 units = 900 round-trips for evidence+states+judgments alone.
 *   After:  3 calls total (one batched script per method).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Postgres storeExtractedGraphPostgres ──────────────────────────────────────

type CapturedSql = { text: string; params: unknown[] };
const capturedSql: CapturedSql[] = [];

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
      capturedSql.push({ text: strings.join("$"), params: values });
      return Promise.resolve([]);
    };
    return tag;
  },
}));

process.env.DATABASE_URL = "postgres://test:test@localhost/test";
vi.mock("$env/dynamic/private", () => ({ env: process.env }));

describe("storeExtractedGraphPostgres — batch extraction writes (order-preserving)", () => {
  beforeEach(() => {
    capturedSql.length = 0;
  });

  it("inserts all units in a single round-trip using unnest WITH ORDINALITY", async () => {
    const { storeExtractedGraphPostgres } = await import("$lib/server/neon");
    const result = await storeExtractedGraphPostgres({
      workspaceId: "ws1",
      sourceId: "src1",
      units: [
        { localId: "a", text: "Unit alpha", unitType: "claim", domain: null },
        { localId: "b", text: "Unit beta", unitType: null, domain: "docs" },
        { localId: "c", text: "Unit gamma", unitType: "claim", domain: null, sourceChunkIndex: 1 },
      ],
      relations: [],
    });

    // Three non-empty units returned in insertion order.
    expect(result.units).toHaveLength(3);
    expect(result.units.map((u) => u.text)).toEqual(["Unit alpha", "Unit beta", "Unit gamma"]);

    // Exactly one INSERT for units (not three per-row round-trips).
    const unitInserts = capturedSql.filter(
      (c) => c.text.includes("INSERT INTO knowledge_graph_units") && c.text.includes("unnest"),
    );
    expect(unitInserts).toHaveLength(1);
    expect(unitInserts[0]!.text).toContain("WITH ORDINALITY");
    expect(unitInserts[0]!.text).toContain("ORDER BY u.ord");
  });

  it("inserts all relations in a single round-trip using unnest", async () => {
    const { storeExtractedGraphPostgres } = await import("$lib/server/neon");
    capturedSql.length = 0;
    const result = await storeExtractedGraphPostgres({
      workspaceId: "ws1",
      sourceId: "src1",
      units: [
        { localId: "x", text: "Unit X", unitType: null, domain: null },
        { localId: "y", text: "Unit Y", unitType: null, domain: null },
      ],
      relations: [{ fromLocalId: "x", toLocalId: "y", relationType: "supports" }],
    });

    expect(result.relations).toBe(1);
    const relInserts = capturedSql.filter(
      (c) => c.text.includes("INSERT INTO knowledge_graph_relations") && c.text.includes("unnest"),
    );
    expect(relInserts).toHaveLength(1);
  });

  it("order preservation: returned units are in the same positional order as input", async () => {
    const { storeExtractedGraphPostgres } = await import("$lib/server/neon");
    capturedSql.length = 0;
    const input = [
      { localId: "first", text: "First claim", unitType: null, domain: null },
      { localId: "second", text: "Second claim", unitType: null, domain: null },
      { localId: "third", text: "Third claim", unitType: null, domain: null },
    ];
    const result = await storeExtractedGraphPostgres({
      workspaceId: "ws1",
      sourceId: "src1",
      units: input,
      relations: [],
    });

    // GraphWriter.writeUnitsAndRelations maps result.units[i] ↔ args.units[i] by index.
    expect(result.units).toHaveLength(3);
    for (let i = 0; i < input.length; i++) {
      expect(result.units[i]!.text).toBe(input[i]!.text);
      expect(result.units[i]!.type).toBe(input[i]!.unitType);
    }
  });

  it("empty-text units are filtered and do not shift positional mapping of valid units", async () => {
    const { storeExtractedGraphPostgres } = await import("$lib/server/neon");
    capturedSql.length = 0;
    const result = await storeExtractedGraphPostgres({
      workspaceId: "ws1",
      sourceId: "src1",
      units: [
        { localId: "valid1", text: "Real claim", unitType: null, domain: null },
        { localId: "empty", text: "  ", unitType: null, domain: null },
        { localId: "valid2", text: "Another claim", unitType: null, domain: null },
      ],
      relations: [{ fromLocalId: "valid1", toLocalId: "valid2", relationType: "links" }],
    });

    expect(result.units).toHaveLength(2);
    expect(result.units[0]!.text).toBe("Real claim");
    expect(result.units[1]!.text).toBe("Another claim");
    // Relation between the two valid units should still resolve.
    expect(result.relations).toBe(1);
  });

  it("no-op on empty input: zero INSERT round-trips", async () => {
    const { storeExtractedGraphPostgres } = await import("$lib/server/neon");
    capturedSql.length = 0;
    const result = await storeExtractedGraphPostgres({
      workspaceId: "ws1",
      sourceId: "src1",
      units: [],
      relations: [],
    });

    expect(result.units).toHaveLength(0);
    expect(result.relations).toBe(0);
    const insertCalls = capturedSql.filter(
      (c) =>
        c.text.includes("INSERT INTO knowledge_graph_units") ||
        c.text.includes("INSERT INTO knowledge_graph_relations"),
    );
    expect(insertCalls).toHaveLength(0);
  });
});

// ── Surreal SurrealGraphWriter — batched round-trips ─────────────────────────

import type { GraphStore } from "@restormel/graphrag-core";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { makeSurrealGraphWriterForTest } from "./graph-writer";

/** Minimal domain pack fixture for the Surreal writer tests. */
function makePack(unitTable = "unit"): ConnectDomainPack {
  return {
    id: "test-pack",
    slug: "test",
    label: "Test",
    description: null,
    ontology: {
      schema_mode: "open",
      unit_types: [],
      domains: [],
      relation_types: [],
    },
    graph_schema: {
      source_table: "source",
      unit_table: unitTable,
      group_table: "group",
      part_of_edge: "part_of",
      unit_vector_field: "embedding",
    },
    chunking: { strategy: "paragraph", max_tokens: 800 },
    prompts: {
      extract_system: "",
      extract_user: "",
      relate_system: null,
      relate_user: null,
      group_system: null,
      group_user: null,
      validate_system: "",
      validate_user: "",
      remediate_system: null,
      remediate_user: null,
    },
    quality: null,
  } as unknown as ConnectDomainPack;
}

/** Build a mock GraphStore that records every query call. */
function makeMockStore(responseFactory?: (sql: string) => unknown): {
  store: GraphStore;
  calls: string[];
} {
  const calls: string[] = [];
  const store: GraphStore = {
    // Cast needed: vi.fn returns Mock<…>, but GraphStore.query is generic; at test
    // boundaries the mock always returns `unknown` which is what tests assert against.
    query: (async (sql: string) => {
      calls.push(sql);
      return (responseFactory ? responseFactory(sql) : []) as never;
    }) as GraphStore["query"],
    isDatabaseUnavailable: () => false,
  };
  return { store, calls };
}

describe("SurrealGraphWriter — setEvidence batched round-trips", () => {
  it("issues exactly ONE store.query call for N bindings (not N calls)", async () => {
    // Simulated read-back: evidence_status matches the written value for all 3 records.
    const { store, calls } = makeMockStore(() => [
      [{ evidence_status: "bound" }],
      [{ evidence_status: "unbound" }],
      [{ evidence_status: "bound" }],
    ]);
    const writer = makeSurrealGraphWriterForTest(store, makePack());

    const result = await writer.setEvidence({
      sourceHash: "abc123",
      bindings: [
        {
          unitId: "unit:u1",
          text: "Claim 1",
          binding: {
            status: "bound",
            span: { quote: "q", start: 0, end: 5, match: "exact", source_hash: "abc123" },
          },
        },
        {
          unitId: "unit:u2",
          text: "Claim 2",
          binding: { status: "unbound", reason: "quote_not_found" },
        },
        {
          unitId: "unit:u3",
          text: "Claim 3",
          binding: {
            status: "bound",
            span: { quote: "r", start: 10, end: 15, match: "exact", source_hash: "abc123" },
          },
        },
      ],
    });

    // All three UPDATE statements coalesced into one store.query call.
    const updateCalls = calls.filter(
      (s) => s.includes("UPDATE unit:u1") || s.includes("UPDATE unit:u2") || s.includes("UPDATE unit:u3"),
    );
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toContain("UPDATE unit:u1");
    expect(updateCalls[0]).toContain("UPDATE unit:u2");
    expect(updateCalls[0]).toContain("UPDATE unit:u3");

    // Per-record read-back: all 3 records returned matching values.
    expect(result.persisted).toBe(3);
    expect(result.missed).toBe(0);
  });

  it("per-record verification: counts a missed write when read-back field does not match", async () => {
    // SCHEMAFULL table drops the field: returned record has null evidence_status for u1.
    const { store } = makeMockStore(() => [
      [{ evidence_status: null }],
      [{ evidence_status: "bound" }],
    ]);
    const writer = makeSurrealGraphWriterForTest(store, makePack());

    const result = await writer.setEvidence({
      sourceHash: "h",
      bindings: [
        {
          unitId: "unit:u1",
          text: "c1",
          binding: { status: "bound", span: { quote: "q", start: 0, end: 1, match: "exact", source_hash: "h" } },
        },
        {
          unitId: "unit:u2",
          text: "c2",
          binding: { status: "bound", span: { quote: "r", start: 2, end: 3, match: "exact", source_hash: "h" } },
        },
      ],
    });

    // u1 missed (SCHEMAFULL drop), u2 persisted.
    expect(result.missed).toBe(1);
    expect(result.persisted).toBe(1);
  });

  it("no-op on empty bindings: zero store.query calls", async () => {
    const { store, calls } = makeMockStore();
    const writer = makeSurrealGraphWriterForTest(store, makePack());

    const result = await writer.setEvidence({ sourceHash: "h", bindings: [] });
    expect(result.persisted).toBe(0);
    expect(result.missed).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("SurrealGraphWriter — setVerificationStates batched round-trips", () => {
  it("issues exactly ONE store.query call for N states (not N calls)", async () => {
    const { store, calls } = makeMockStore(() => [
      [{ verification_state: "supported" }],
      [{ verification_state: "unverified" }],
    ]);
    const writer = makeSurrealGraphWriterForTest(store, makePack());

    const result = await writer.setVerificationStates([
      { unitId: "unit:u1", state: "supported" },
      { unitId: "unit:u2", state: "unverified" },
    ]);

    const updateCalls = calls.filter(
      (s) => s.includes("UPDATE unit:u1") || s.includes("UPDATE unit:u2"),
    );
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toContain("UPDATE unit:u1");
    expect(updateCalls[0]).toContain("UPDATE unit:u2");
    expect(result.persisted).toBe(2);
    expect(result.missed).toBe(0);
  });

  it("no-op on empty states: zero store.query calls", async () => {
    const { store, calls } = makeMockStore();
    const writer = makeSurrealGraphWriterForTest(store, makePack());

    const result = await writer.setVerificationStates([]);
    expect(result.persisted).toBe(0);
    expect(result.missed).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("SurrealGraphWriter — recordJudgments batched round-trips", () => {
  it("issues exactly ONE store.query call for N judgments (not N calls)", async () => {
    const { store, calls } = makeMockStore(() => [
      [{ verdict: "entailed" }],
      [{ verdict: "contradicted" }],
    ]);
    const writer = makeSurrealGraphWriterForTest(store, makePack());
    const judgedAt = new Date().toISOString();

    const result = await writer.recordJudgments([
      {
        unitId: "unit:u1",
        verdict: "entailed",
        confidence: 0.9,
        note: null,
        judgeModel: "m1",
        promptVersion: 1,
        judgedAt,
      },
      {
        unitId: "unit:u2",
        verdict: "contradicted",
        confidence: 0.2,
        note: null,
        judgeModel: "m1",
        promptVersion: 1,
        judgedAt,
      },
    ]);

    const createCalls = calls.filter((s) => s.includes("CREATE connect_claim_judgment"));
    expect(createCalls).toHaveLength(1);
    // Both judgment payloads in the single script.
    expect(createCalls[0]).toContain("unit:u1");
    expect(createCalls[0]).toContain("unit:u2");
    expect(result.persisted).toBe(2);
    expect(result.missed).toBe(0);
  });

  it("no-op on empty rows: zero store.query calls", async () => {
    const { store, calls } = makeMockStore();
    const writer = makeSurrealGraphWriterForTest(store, makePack());

    const result = await writer.recordJudgments([]);
    expect(result.persisted).toBe(0);
    expect(result.missed).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("SurrealGraphWriter — writeUnitsAndRelations batched round-trips", () => {
  it("issues exactly ONE store.query call for N unit CREATEs (not N calls)", async () => {
    const { store, calls } = makeMockStore(() => [[{ id: "unit:r1" }], [{ id: "unit:r2" }]]);
    const writer = makeSurrealGraphWriterForTest(store, makePack());

    const result = await writer.writeUnitsAndRelations({
      sourceId: "source:s1",
      units: [
        { localId: "a", text: "Claim A", unitType: null, domain: null },
        { localId: "b", text: "Claim B", unitType: null, domain: null },
      ],
      relations: [],
    });

    const createCalls = calls.filter((s) => s.includes("CREATE unit"));
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toContain("Claim A");
    expect(createCalls[0]).toContain("Claim B");
    expect(result.units).toHaveLength(2);
  });

  it("issues exactly ONE store.query call for N RELATEs (not N calls)", async () => {
    let callIdx = 0;
    const { store, calls } = makeMockStore(() => {
      callIdx++;
      if (callIdx === 1) return [[{ id: "unit:r1" }], [{ id: "unit:r2" }]];
      return [];
    });
    const writer = makeSurrealGraphWriterForTest(store, makePack());

    const result = await writer.writeUnitsAndRelations({
      sourceId: "source:s1",
      units: [
        { localId: "a", text: "Claim A", unitType: null, domain: null },
        { localId: "b", text: "Claim B", unitType: null, domain: null },
      ],
      relations: [{ fromLocalId: "a", toLocalId: "b", relationType: "supports" }],
    });

    const relateCalls = calls.filter((s) => s.includes("RELATE"));
    expect(relateCalls).toHaveLength(1);
    expect(relateCalls[0]).toContain("RELATE unit:r1->supports->unit:r2");
    expect(result.relations).toBe(1);
  });
});
