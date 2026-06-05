/**
 * Paginated Surreal unit reads for graph explorer and re-validation (avoids HTTP 400 on large FETCH).
 */
import type { GraphStore } from "@restormel/graphrag-core";

export const SURREAL_GRAPH_UNIT_PAGE_SIZE = 200;
export const SURREAL_GRAPH_UNIT_MAX = 5000;

const UNIT_TEXT_KEYS = ["text", "statement", "content", "body", "claim", "summary", "description"] as const;

function isSurrealHttp400(err: unknown): boolean {
  return err instanceof Error && err.message.includes("Surreal HTTP 400");
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
  if (variant === "star") {
    return `SELECT * FROM ${unitTable} LIMIT ${limit} START ${start};`;
  }
  if (variant === "enriched") {
    return `SELECT id, text, validation_status, validation_note, source.title AS source_title, source.url AS source_url, source FROM ${unitTable} FETCH source LIMIT ${limit} START ${start};`;
  }
  return `SELECT id, text, validation_status, source FROM ${unitTable} LIMIT ${limit} START ${start};`;
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

/** Paginate Surreal units until empty (no 5k cap — for graph re-validation / auto-remediation). */
export async function paginateSurrealUnitRowsAll<T>(
  store: GraphStore,
  buildQuery: (limit: number, start: number, fetchSource: boolean) => string,
): Promise<T[]> {
  const rows: T[] = [];
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
    rows.push(...page);
    if (page.length < limit) break;
  }
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
  const variants: SurrealExplorerQueryVariant[] = ["enriched", "minimal", "star"];
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
  const variants: SurrealExplorerQueryVariant[] = ["enriched", "minimal", "star"];
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
