/**
 * Paginated Surreal unit reads for graph explorer and re-validation (avoids HTTP 400 on large FETCH).
 */
import type { GraphStore } from "@restormel/graphrag-core";

export const SURREAL_GRAPH_UNIT_PAGE_SIZE = 200;
export const SURREAL_GRAPH_UNIT_MAX = 5000;

const UNIT_TEXT_KEYS = ["text", "statement", "content", "body", "claim", "summary", "description"] as const;

/** Common field names a Bring-Your-Own graph may store embedding vectors under. */
export const VECTOR_FIELD_CANDIDATES = [
  "embedding",
  "vector",
  "embeddings",
  "embed",
  "vector_embedding",
  "embedding_vector",
] as const;

const SAFE_FIELD_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function fieldIdent(name: string | null | undefined): string {
  return name && SAFE_FIELD_IDENT.test(name) ? name : "embedding";
}

function isSurrealHttp400(err: unknown): boolean {
  return err instanceof Error && err.message.includes("Surreal HTTP 400");
}

/**
 * Count units whose embedding vector is populated. Tries the configured field
 * first, then common aliases — so a Bring-Your-Own graph that stored vectors as
 * `vector` (etc.) is recognised instead of showing "0 embedded". Returns the
 * field that actually matched so callers can persist it for writes + retrieval.
 */
export async function detectEmbeddedUnits(
  store: GraphStore,
  unitTable: string,
  configuredField: string | null | undefined,
): Promise<{ field: string; embedded: number }> {
  const primaryField = fieldIdent(configuredField);
  const tryField = async (f: string): Promise<number> => {
    try {
      const rows = await store.query<{ count?: number }[]>(
        `SELECT count() AS count FROM ${unitTable} WHERE ${f} IS NOT NONE GROUP ALL;`,
      );
      return Number(rows[0]?.count ?? 0);
    } catch {
      return 0;
    }
  };

  const primary = await tryField(primaryField);
  if (primary > 0) return { field: primaryField, embedded: primary };

  for (const candidate of VECTOR_FIELD_CANDIDATES) {
    if (candidate === primaryField) continue;
    const count = await tryField(candidate);
    if (count > 0) return { field: candidate, embedded: count };
  }
  return { field: primaryField, embedded: 0 };
}

/** Resolve display text from Restormel ingest rows or legacy BYO schemas (e.g. `statement`). */
export function pickSurrealUnitText(row: Record<string, unknown>): string | null {
  for (const key of UNIT_TEXT_KEYS) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export type SurrealExplorerQueryVariant = "minimal" | "enriched" | "star";

export function surrealExplorerUnitsQuery(
  unitTable: string,
  limit: number,
  start: number,
  variant: SurrealExplorerQueryVariant,
): string {
  // Validated ideas first: a real verdict (ok/weak/unsupported) sorts ahead of
  // NONE/unchecked under DESC, so the first page surfaces freshly-validated ideas
  // instead of burying them in raw store order. Also makes START paging stable.
  const order = " ORDER BY validation_status DESC";
  if (variant === "star") {
    return `SELECT * FROM ${unitTable}${order} LIMIT ${limit} START ${start};`;
  }
  if (variant === "enriched") {
    return `SELECT id, text, validation_status, validation_note, source.title AS source_title, source.url AS source_url, source FROM ${unitTable}${order} FETCH source LIMIT ${limit} START ${start};`;
  }
  return `SELECT id, text, validation_status, source FROM ${unitTable}${order} LIMIT ${limit} START ${start};`;
}

export function surrealRevalidateUnitsQuery(
  unitTable: string,
  limit: number,
  start: number,
  fetchSource: boolean,
): string {
  if (!fetchSource) {
    return `SELECT id, text, validation_status, validation_note, source FROM ${unitTable} LIMIT ${limit} START ${start};`;
  }
  return `SELECT id, text, validation_status, validation_note, source.title AS source_title, source.url AS source_url, source FROM ${unitTable} FETCH source LIMIT ${limit} START ${start};`;
}

/** Source-linking scan — no FETCH; optional WHERE for ideas missing a real source edge. */
export function surrealSourceLinkUnitsQuery(
  unitTable: string,
  limit: number,
  start: number,
  opts?: { unlinkedOnly?: boolean },
): string {
  const fields = [
    "id",
    "text",
    "validation_status",
    "validation_note",
    "source.source_kind AS source_kind",
    "source.title AS source_title",
    "source.url AS source_url",
    "source.text_preview AS text_preview",
    "source",
  ].join(", ");
  const where =
    opts?.unlinkedOnly === true
      ? " WHERE source IS NONE OR source.source_kind = 'legacy'"
      : "";
  return `SELECT ${fields} FROM ${unitTable}${where} LIMIT ${limit} START ${start};`;
}

/**
 * Stream Surreal unit pages until empty (no 5k cap), invoking `onPage` per page so
 * the caller never has to hold the whole table in memory (large graphs OOM'd the app).
 *
 * Uses START-offset paging, so it is only safe for **read-only** scans — callers that
 * mutate the rows mid-scan (e.g. writing embeddings) must drain instead (see callers).
 */
export async function streamSurrealUnitRowsAll<T>(
  store: GraphStore,
  buildQuery: (limit: number, start: number, fetchSource: boolean) => string,
  /** Return `true` to stop early (e.g. a batch cap was reached). */
  onPage: (rows: T[]) => Promise<void | boolean> | void | boolean,
): Promise<void> {
  let fetchSource = true;
  for (let start = 0; ; start += SURREAL_GRAPH_UNIT_PAGE_SIZE) {
    const limit = SURREAL_GRAPH_UNIT_PAGE_SIZE;
    let page: T[];
    try {
      page = await store.query<T[]>(buildQuery(limit, start, fetchSource));
    } catch (err) {
      if (fetchSource && start === 0 && isSurrealHttp400(err)) {
        fetchSource = false;
        page = await store.query<T[]>(buildQuery(limit, start, false));
      } else {
        throw err;
      }
    }
    if (!page.length) break;
    const stop = await onPage(page);
    if (stop === true) break;
    if (page.length < limit) break;
  }
}

/** Paginate Surreal units until empty (no 5k cap — for graph re-validation / auto-remediation). */
export async function paginateSurrealUnitRowsAll<T>(
  store: GraphStore,
  buildQuery: (limit: number, start: number, fetchSource: boolean) => string,
): Promise<T[]> {
  const rows: T[] = [];
  await streamSurrealUnitRowsAll<T>(store, buildQuery, (page) => {
    rows.push(...page);
  });
  return rows;
}

async function paginateWithVariant<T>(
  store: GraphStore,
  buildQuery: (limit: number, start: number) => string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; start < SURREAL_GRAPH_UNIT_MAX; start += SURREAL_GRAPH_UNIT_PAGE_SIZE) {
    const limit = Math.min(SURREAL_GRAPH_UNIT_PAGE_SIZE, SURREAL_GRAPH_UNIT_MAX - start);
    const page = await store.query<T[]>(buildQuery(limit, start));
    if (!page.length) break;
    rows.push(...page);
    if (page.length < limit) break;
  }
  return rows;
}

export async function paginateSurrealUnitRows<T>(
  store: GraphStore,
  buildQuery: (limit: number, start: number, fetchSource: boolean) => string,
): Promise<T[]> {
  const rows: T[] = [];
  let fetchSource = true;
  for (let start = 0; start < SURREAL_GRAPH_UNIT_MAX; start += SURREAL_GRAPH_UNIT_PAGE_SIZE) {
    const limit = Math.min(SURREAL_GRAPH_UNIT_PAGE_SIZE, SURREAL_GRAPH_UNIT_MAX - start);
    let page: T[];
    try {
      page = await store.query<T[]>(buildQuery(limit, start, fetchSource));
    } catch (err) {
      if (fetchSource && start === 0 && isSurrealHttp400(err)) {
        fetchSource = false;
        page = await store.query<T[]>(buildQuery(limit, start, false));
      } else {
        throw err;
      }
    }
    if (!page.length) break;
    rows.push(...page);
    if (page.length < limit) break;
  }
  return rows;
}

/**
 * Load explorer units with fallbacks: minimal SELECT → enriched FETCH → SELECT *.
 * BYO schemas often omit `unit_type`, `domain`, or `source_kind` — those break enriched SELECT.
 */
/** Load a single page of Surreal explorer units (for progressive graph pagination). */
export async function loadSurrealExplorerUnitPage(
  store: GraphStore,
  unitTable: string,
  opts: { start: number; limit: number },
): Promise<{ rows: Record<string, unknown>[]; variant: SurrealExplorerQueryVariant }> {
  const start = Math.max(0, opts.start);
  const limit = Math.min(Math.max(opts.limit, 1), SURREAL_GRAPH_UNIT_PAGE_SIZE);
  const variants: SurrealExplorerQueryVariant[] = ["minimal", "enriched", "star"];
  let lastError: unknown;
  for (const variant of variants) {
    try {
      const rows = await store.query<Record<string, unknown>[]>(
        surrealExplorerUnitsQuery(unitTable, limit, start, variant),
      );
      return { rows, variant };
    } catch (err) {
      lastError = err;
      if (!isSurrealHttp400(err) && variant === "minimal") throw err;
      console.warn(
        `[connect-graph-units] explorer page ${variant} query failed for ${unitTable}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  if (lastError) throw lastError;
  return { rows: [], variant: "minimal" };
}

export async function loadSurrealExplorerUnitRows(
  store: GraphStore,
  unitTable: string,
): Promise<{ rows: Record<string, unknown>[]; variant: SurrealExplorerQueryVariant }> {
  const variants: SurrealExplorerQueryVariant[] = ["minimal", "enriched", "star"];
  let lastError: unknown;
  for (const variant of variants) {
    try {
      const rows = await paginateWithVariant<Record<string, unknown>>(store, (limit, start) =>
        surrealExplorerUnitsQuery(unitTable, limit, start, variant),
      );
      if (rows.length > 0) {
        return { rows, variant };
      }
      if (variant === "star") return { rows: [], variant };
    } catch (err) {
      lastError = err;
      if (!isSurrealHttp400(err) && variant === "minimal") throw err;
      console.warn(
        `[connect-graph-units] explorer ${variant} query failed for ${unitTable}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  if (lastError) throw lastError;
  return { rows: [], variant: "minimal" };
}
