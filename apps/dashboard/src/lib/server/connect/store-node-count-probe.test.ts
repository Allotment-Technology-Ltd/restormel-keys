/**
 * M3 Store — read-only node-count probe (RES-113 PR-K, REC-ADR-017 §2).
 *
 * Env-INDEPENDENT unit tests for:
 *   - the read-only query guard (rejects every write/DDL verb; accepts the probe
 *     query constants) — the load-bearing non-destructiveness guarantee at the
 *     probe layer,
 *   - count/last-write PARSING for Surreal, Neo4j and the managed-Postgres origin,
 *   - the probe runners dispatching only read-only queries via injected ports, and
 *     mapping a runner failure to an "unreachable" (never a fabricated count).
 *
 * Running the real queries against a live store is ENV-PENDING — here the engine
 * I/O is faked through the injectable runners.
 */
import { describe, expect, it, vi } from "vitest";
import {
  NEO4J_NODE_COUNT_CYPHER,
  SURREAL_LAST_WRITE_SQL,
  SURREAL_NODE_COUNT_SQL,
  assertReadOnlyStoreQuery,
  coerceCount,
  parseNeo4jNodeCount,
  parseSurrealLastWrite,
  parseSurrealNodeCount,
  probeNeo4jNodeCount,
  probePostgresNodeCount,
  probeSurrealNodeCount,
  type Neo4jCountRecordLike,
} from "./store-node-count-probe";

describe("assertReadOnlyStoreQuery", () => {
  const writes = [
    "DELETE claim",
    "REMOVE TABLE claim",
    "UPDATE claim SET x = 1",
    "CREATE claim CONTENT {}",
    "INSERT INTO claim",
    "UPSERT claim:1",
    "MATCH (n) DETACH DELETE n",
    "MERGE (c:Claim {id:1})",
    "MATCH (c) SET c.x = 1",
    "DROP INDEX foo",
    "DEFINE TABLE claim",
    "RELATE a->b->c",
    "CALL db.index.fulltext.drop('x')",
    "TRUNCATE claim",
  ];
  for (const q of writes) {
    it(`rejects a mutating query: ${q.slice(0, 24)}…`, () => {
      expect(() => assertReadOnlyStoreQuery(q)).toThrow(/read-only/i);
    });
  }

  it("accepts the probe query constants", () => {
    expect(() => assertReadOnlyStoreQuery(SURREAL_NODE_COUNT_SQL)).not.toThrow();
    expect(() => assertReadOnlyStoreQuery(SURREAL_LAST_WRITE_SQL)).not.toThrow();
    expect(() => assertReadOnlyStoreQuery(NEO4J_NODE_COUNT_CYPHER)).not.toThrow();
  });

  it("does not false-positive on substrings (e.g. 'settings', 'created_at')", () => {
    expect(() => assertReadOnlyStoreQuery("SELECT settings, created_at FROM claim")).not.toThrow();
  });
});

describe("coerceCount", () => {
  it("handles numbers, bigints, strings and Neo4j integer shapes", () => {
    expect(coerceCount(42)).toBe(42);
    expect(coerceCount(10n)).toBe(10);
    expect(coerceCount("7")).toBe(7);
    expect(coerceCount({ toNumber: () => 5 })).toBe(5);
    expect(coerceCount({ low: 3, high: 0 })).toBe(3);
  });

  it("returns null for non-numeric / infinite values", () => {
    expect(coerceCount(undefined)).toBeNull();
    expect(coerceCount("abc")).toBeNull();
    expect(coerceCount(Infinity)).toBeNull();
    expect(coerceCount({})).toBeNull();
  });
});

describe("parseSurrealNodeCount", () => {
  it("reads the count from a [{ count }] envelope", () => {
    expect(parseSurrealNodeCount([{ count: 4210 }])).toBe(4210);
  });
  it("treats an empty result (empty table) as zero", () => {
    expect(parseSurrealNodeCount([])).toBe(0);
    expect(parseSurrealNodeCount(null)).toBe(0);
  });
  it("falls back to zero on a malformed row", () => {
    expect(parseSurrealNodeCount([{ nope: 1 }])).toBe(0);
  });
});

describe("parseSurrealLastWrite", () => {
  it("returns an ISO string when present", () => {
    expect(parseSurrealLastWrite([{ updated_at: "2026-06-25T09:00:00.000Z" }])).toBe(
      "2026-06-25T09:00:00.000Z",
    );
  });
  it("coerces Date and epoch-ms shapes", () => {
    const d = new Date("2026-06-25T09:00:00.000Z");
    expect(parseSurrealLastWrite([{ updated_at: d }])).toBe(d.toISOString());
    expect(parseSurrealLastWrite([{ updated_at: d.getTime() }])).toBe(d.toISOString());
  });
  it("returns null when absent", () => {
    expect(parseSurrealLastWrite([])).toBeNull();
    expect(parseSurrealLastWrite([{ updated_at: null }])).toBeNull();
  });
});

function neo4jRecords(n: unknown): Neo4jCountRecordLike[] {
  return [{ get: (k: string) => (k === "n" ? n : undefined) }];
}

describe("parseNeo4jNodeCount", () => {
  it("reads count(c) AS n", () => {
    expect(parseNeo4jNodeCount(neo4jRecords(4210))).toBe(4210);
  });
  it("coerces a Neo4j integer shape", () => {
    expect(parseNeo4jNodeCount(neo4jRecords({ toNumber: () => 88 }))).toBe(88);
  });
  it("treats an empty record list as zero", () => {
    expect(parseNeo4jNodeCount([])).toBe(0);
    expect(parseNeo4jNodeCount(null)).toBe(0);
  });
});

describe("probeSurrealNodeCount", () => {
  it("dispatches only read-only queries and returns a reachable summary", async () => {
    const seen: string[] = [];
    const run = vi.fn(async (sql: string) => {
      seen.push(sql);
      if (sql === SURREAL_NODE_COUNT_SQL) return { ok: true as const, data: [{ count: 4210 }] };
      return { ok: true as const, data: [{ updated_at: "2026-06-25T09:00:00.000Z" }] };
    });
    const summary = await probeSurrealNodeCount(run);
    expect(summary).toEqual({
      engine: "surreal",
      reachable: true,
      nodeCount: 4210,
      lastWriteAt: "2026-06-25T09:00:00.000Z",
    });
    // Every dispatched query is read-only.
    for (const q of seen) expect(() => assertReadOnlyStoreQuery(q)).not.toThrow();
  });

  it("reports an empty store as nodeCount 0 (reachable, offers no choice upstream)", async () => {
    const run = vi.fn(async () => ({ ok: true as const, data: [] }));
    const summary = await probeSurrealNodeCount(run);
    expect(summary.reachable).toBe(true);
    expect(summary.nodeCount).toBe(0);
  });

  it("maps a failed count to unreachable (never a fabricated count)", async () => {
    const run = vi.fn(async () => ({ ok: false as const, error: "HTTP 401" }));
    const summary = await probeSurrealNodeCount(run);
    expect(summary).toEqual({
      engine: "surreal",
      reachable: false,
      nodeCount: null,
      lastWriteAt: null,
    });
  });

  it("tolerates a missing last-write (count still returns) ", async () => {
    const run = vi.fn(async (sql: string) =>
      sql === SURREAL_NODE_COUNT_SQL
        ? { ok: true as const, data: [{ count: 12 }] }
        : { ok: false as const, error: "no updated_at column" },
    );
    const summary = await probeSurrealNodeCount(run);
    expect(summary.reachable).toBe(true);
    expect(summary.nodeCount).toBe(12);
    expect(summary.lastWriteAt).toBeNull();
  });
});

describe("probeNeo4jNodeCount", () => {
  it("returns a reachable summary from the Cypher count", async () => {
    const run = vi.fn(async (cypher: string) => {
      expect(() => assertReadOnlyStoreQuery(cypher)).not.toThrow();
      return { ok: true as const, records: neo4jRecords(909) };
    });
    const summary = await probeNeo4jNodeCount(run);
    expect(summary).toEqual({
      engine: "neo4j",
      reachable: true,
      nodeCount: 909,
      lastWriteAt: null,
    });
  });

  it("maps a driver failure to unreachable", async () => {
    const run = vi.fn(async () => ({ ok: false as const, error: "ServiceUnavailable" }));
    expect(await probeNeo4jNodeCount(run)).toEqual({
      engine: "neo4j",
      reachable: false,
      nodeCount: null,
      lastWriteAt: null,
    });
  });
});

describe("probePostgresNodeCount (managed origin, #288)", () => {
  it("returns a reachable summary from the spine count", async () => {
    const summary = await probePostgresNodeCount(async () => 128);
    expect(summary).toEqual({
      engine: "postgres",
      reachable: true,
      nodeCount: 128,
      lastWriteAt: null,
    });
  });

  it("maps a read error to unreachable", async () => {
    const summary = await probePostgresNodeCount(async () => {
      throw new Error("db down");
    });
    expect(summary.reachable).toBe(false);
    expect(summary.nodeCount).toBeNull();
  });
});
