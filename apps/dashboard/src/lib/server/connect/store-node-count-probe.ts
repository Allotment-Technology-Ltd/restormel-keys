/**
 * M3 Store — read-only node-count probe of a target store (RES-113 PR-K, REC-ADR-017 §2).
 *
 * Before offering the non-destructive use/add/keep-separate choice we must state
 * plainly what is already in the target store ("Connected to SurrealDB · acme/
 * prod_graph · 4,210 nodes, last write 3 days ago"). This module performs that
 * inspection as a **strictly read-only** probe: it issues a COUNT-only query and,
 * where the engine exposes it, a most-recent-write lookup — never a write, copy,
 * or migrate. Inspecting a non-empty customer store is itself a read of customer
 * data (REC-ADR-017 Consequences); the probe is the only place that read happens
 * and it is bounded to counts + timestamps.
 *
 * NON-DESTRUCTIVENESS, defence in depth:
 *  - Every query string is checked by {@link assertReadOnlyStoreQuery}, which
 *    rejects any write/DDL keyword (DELETE/REMOVE/UPDATE/CREATE/MERGE/SET/DROP…)
 *    before it can be dispatched. The probe literally cannot send a mutating
 *    statement, even if a query constant were mis-edited.
 *
 * Engine support (REC-ADR-021 M3 — minimal proven engines):
 *  - postgres  — the host-managed Postgres origin (#288); counted via the spine.
 *  - surreal   — BYO SurrealDB, `SELECT count() … GROUP ALL` over the node table.
 *  - neo4j     — BYO Neo4j, `MATCH (c:Claim) RETURN count(c)`.
 *
 * ENV-PENDING: the parsing + read-only guard + dispatch shape here are unit-tested
 * with injected runners; running the real queries against a live Surreal/Neo4j/
 * managed-Postgres and confirming the counts is verified only on the integration
 * environment.
 */
import type { StoreMoveEngine, TargetStoreProbeSummary } from "./store-move-plan";

/**
 * Write / DDL keywords that must never appear in a probe query. Word-bounded and
 * case-insensitive. Covers SurrealQL, Cypher and SQL mutation + DDL verbs.
 */
const WRITE_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "UPSERT",
  "CREATE",
  "MERGE",
  "REMOVE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "RELATE",
  "DEFINE",
  "DETACH",
  "GRANT",
  "REVOKE",
  // `SET` (SurrealQL UPDATE…SET / Cypher SET) — bounded so it never matches e.g. "settings".
  "SET",
  "CALL", // Cypher CALL can invoke mutating procedures — disallow in a read-only probe.
] as const;

const WRITE_KEYWORD_RE = new RegExp(`\\b(${WRITE_KEYWORDS.join("|")})\\b`, "i");

/**
 * Throw unless `sql` is read-only (no write/DDL keyword). The probe guards every
 * query with this before dispatch so a mutating statement can never be sent to a
 * customer store, honouring the REC-ADR-017 "connect is side-effect-free" promise.
 */
export function assertReadOnlyStoreQuery(sql: string): void {
  const m = WRITE_KEYWORD_RE.exec(sql);
  if (m) {
    throw new Error(
      `Refusing to run a non-read-only probe query (found write keyword "${m[1].toUpperCase()}"). ` +
        "The M3 store probe must be strictly read-only (REC-ADR-017).",
    );
  }
}

// ── Read-only probe queries (guarded at module load) ──────────────────────────

/** SurrealDB node count over the default graphrag node table ("claim"). Read-only. */
export const SURREAL_NODE_COUNT_SQL = "SELECT count() AS count FROM claim GROUP ALL;";
/** SurrealDB most-recent write timestamp (best-effort; absent on stores without it). */
export const SURREAL_LAST_WRITE_SQL =
  "SELECT updated_at FROM claim ORDER BY updated_at DESC LIMIT 1;";
/** Neo4j node count over the Claim label. Read-only. */
export const NEO4J_NODE_COUNT_CYPHER = "MATCH (c:Claim) RETURN count(c) AS n;";

// Fail fast at import if a constant is ever edited to include a write verb.
for (const q of [SURREAL_NODE_COUNT_SQL, SURREAL_LAST_WRITE_SQL, NEO4J_NODE_COUNT_CYPHER]) {
  assertReadOnlyStoreQuery(q);
}

// ── Result parsing (pure; unit-tested) ────────────────────────────────────────

/** Coerce an unknown numeric-ish value (incl. Neo4j integer shapes, bigint, strings) to number|null. */
export function coerceCount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof value === "object") {
    const v = value as { toNumber?: () => number; low?: number };
    if (typeof v.toNumber === "function") {
      const n = v.toNumber();
      return Number.isFinite(n) ? n : null;
    }
    if (typeof v.low === "number") return v.low;
  }
  return null;
}

/**
 * Parse a SurrealDB `SELECT count() AS count FROM <table> GROUP ALL` result into a
 * node count. Surreal returns `[{ count }]` (empty table → `[]`, i.e. zero).
 */
export function parseSurrealNodeCount(data: unknown): number {
  if (!Array.isArray(data) || data.length === 0) return 0;
  const first = data[0] as { count?: unknown } | null;
  return coerceCount(first?.count) ?? 0;
}

/** Parse a SurrealDB last-write lookup (`[{ updated_at }]`) into an ISO timestamp or null. */
export function parseSurrealLastWrite(data: unknown): string | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0] as { updated_at?: unknown } | null;
  const raw = first?.updated_at;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "number" && Number.isFinite(raw)) return new Date(raw).toISOString();
  return null;
}

/** A minimal Neo4j record shape (`record.get("n")`). */
export interface Neo4jCountRecordLike {
  get(key: string): unknown;
}

/** Parse a Neo4j `RETURN count(c) AS n` result (record list) into a node count. */
export function parseNeo4jNodeCount(records: Neo4jCountRecordLike[] | undefined | null): number {
  if (!records || records.length === 0) return 0;
  return coerceCount(records[0]?.get("n")) ?? 0;
}

/** Build the read-only probe summary from a raw count + optional last-write. */
export function summariseProbe(args: {
  engine: StoreMoveEngine;
  nodeCount: number | null;
  lastWriteAt?: string | null;
}): TargetStoreProbeSummary {
  return {
    engine: args.engine,
    reachable: true,
    nodeCount: args.nodeCount,
    lastWriteAt: args.lastWriteAt ?? null,
  };
}

/** The unreachable summary (probe could not read the store). */
export function unreachableProbe(engine: StoreMoveEngine): TargetStoreProbeSummary {
  return { engine, reachable: false, nodeCount: null, lastWriteAt: null };
}

// ── Engine runners (injectable for tests; I/O lives behind these ports) ───────

/** Runs a read-only SurrealQL statement and returns the raw `{ result }` data. */
export type SurrealProbeRunner = (
  sql: string,
) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;

/** Runs a read-only Cypher statement and returns the record list. */
export type Neo4jProbeRunner = (
  cypher: string,
) => Promise<{ ok: true; records: Neo4jCountRecordLike[] } | { ok: false; error: string }>;

/** Returns the managed Postgres-origin node count for the workspace. */
export type PostgresCountReader = () => Promise<number>;

/**
 * Probe a SurrealDB target's node count + last write, strictly read-only. Each
 * query is guarded by {@link assertReadOnlyStoreQuery} before dispatch.
 */
export async function probeSurrealNodeCount(
  run: SurrealProbeRunner,
): Promise<TargetStoreProbeSummary> {
  assertReadOnlyStoreQuery(SURREAL_NODE_COUNT_SQL);
  const countRes = await run(SURREAL_NODE_COUNT_SQL);
  if (!countRes.ok) return unreachableProbe("surreal");
  const nodeCount = parseSurrealNodeCount(countRes.data);

  // Last-write is best-effort: a store without an `updated_at` column simply
  // yields no timestamp; that must NOT mark the store unreachable.
  let lastWriteAt: string | null = null;
  try {
    assertReadOnlyStoreQuery(SURREAL_LAST_WRITE_SQL);
    const writeRes = await run(SURREAL_LAST_WRITE_SQL);
    if (writeRes.ok) lastWriteAt = parseSurrealLastWrite(writeRes.data);
  } catch {
    lastWriteAt = null;
  }
  return summariseProbe({ engine: "surreal", nodeCount, lastWriteAt });
}

/** Probe a Neo4j target's node count, strictly read-only. */
export async function probeNeo4jNodeCount(run: Neo4jProbeRunner): Promise<TargetStoreProbeSummary> {
  assertReadOnlyStoreQuery(NEO4J_NODE_COUNT_CYPHER);
  const res = await run(NEO4J_NODE_COUNT_CYPHER);
  if (!res.ok) return unreachableProbe("neo4j");
  return summariseProbe({ engine: "neo4j", nodeCount: parseNeo4jNodeCount(res.records) });
}

/** Probe the host-managed Postgres origin's node count (#288). */
export async function probePostgresNodeCount(
  read: PostgresCountReader,
): Promise<TargetStoreProbeSummary> {
  try {
    const nodeCount = await read();
    return summariseProbe({ engine: "postgres", nodeCount });
  } catch {
    return unreachableProbe("postgres");
  }
}
