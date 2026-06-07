/**
 * Surreal provenance aggregates — resolve the live unit table (SOPHIA `claim` vs pack
 * `unit_table`) and count source edges without scanning 30k+ rows.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const SOPHIA_UNIT_TABLE_FALLBACKS = ["claim", "idea", "unit", "statement"] as const;

export function surrealTableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

async function surrealTableCount(store: GraphStore, table: string): Promise<number | null> {
  try {
    const rows = await store.query<{ count?: number }[]>(
      `SELECT count() AS count FROM ${table} GROUP ALL;`,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

async function surrealCountWhere(
  store: GraphStore,
  table: string,
  where: string,
): Promise<number | null> {
  try {
    const rows = await store.query<{ count?: number }[]>(
      `SELECT count() AS count FROM ${table} WHERE ${where} GROUP ALL;`,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

/** Pick the Surreal table that actually holds ideas (aligns with stats cache unit counts). */
export async function resolveSurrealUnitTableForProvenance(
  store: GraphStore,
  pack: ConnectDomainPack | null,
  opts?: { totalUnitsHint?: number },
): Promise<{ unitTable: string | null; totalUnits: number }> {
  const tablesToTry: string[] = [];
  if (pack) {
    tablesToTry.push(surrealTableIdent(pack.graph_schema.unit_table, "unit"));
  }
  for (const fallback of SOPHIA_UNIT_TABLE_FALLBACKS) {
    if (!tablesToTry.includes(fallback)) tablesToTry.push(fallback);
  }

  const counts: { table: string; count: number }[] = [];
  for (const table of tablesToTry) {
    const count = await surrealTableCount(store, table);
    if (count != null && count > 0) counts.push({ table, count });
  }

  if (counts.length === 0) {
    return { unitTable: tablesToTry[0] ?? null, totalUnits: 0 };
  }

  const hint = opts?.totalUnitsHint;
  if (hint != null && hint > 0) {
    const exact = counts.find((c) => c.count === hint);
    if (exact) return { unitTable: exact.table, totalUnits: exact.count };

    const closest = counts.reduce((best, row) =>
      Math.abs(row.count - hint) < Math.abs(best.count - hint) ? row : best,
    );
    return { unitTable: closest.table, totalUnits: closest.count };
  }

  const best = counts.reduce((a, b) => (b.count > a.count ? b : a));
  return { unitTable: best.table, totalUnits: best.count };
}

export type SurrealProvenanceAggregateCounts = {
  unitTable: string;
  totalUnits: number;
  unlinked: number;
  legacyPlaceholder: number;
  graphLinked: number;
  needsEdgeRepair: number;
  aggregatesOk: boolean;
};

export async function loadSurrealProvenanceAggregateCounts(
  store: GraphStore,
  unitTable: string,
): Promise<SurrealProvenanceAggregateCounts> {
  // Only cheap field-presence aggregates. Counting legacy placeholders needs
  // `source.source_kind` — a per-row dereference of the linked source record that
  // does ~N sub-fetches and times out on large (30k+) graphs. We omit it from the
  // hot audit path; linking/validation still surface placeholder issues downstream.
  const [totalUnits, unlinkedPrimary, graphLinkedPrimary] = await Promise.all([
    surrealTableCount(store, unitTable),
    surrealCountWhere(store, unitTable, "source IS NONE"),
    surrealCountWhere(store, unitTable, "source IS NOT NONE"),
  ]);

  const unlinked =
    unlinkedPrimary ??
    (await surrealCountWhere(store, unitTable, "source = NONE"));

  let graphLinked = graphLinkedPrimary;
  if (graphLinked == null) {
    graphLinked = await surrealCountWhere(store, unitTable, "source != NONE");
  }

  const total = totalUnits ?? 0;

  let unlinkedCount = unlinked;
  if (unlinkedCount == null && graphLinked != null && total > 0) {
    unlinkedCount = Math.max(0, total - graphLinked);
  }

  const aggregatesOk = unlinkedCount != null || graphLinked != null;

  const resolvedUnlinked = unlinkedCount ?? 0;
  const needsEdgeRepair = resolvedUnlinked;

  if (graphLinked == null && total > 0 && aggregatesOk) {
    graphLinked = Math.max(0, total - needsEdgeRepair);
  }

  return {
    unitTable,
    totalUnits: total,
    unlinked: resolvedUnlinked,
    legacyPlaceholder: 0,
    graphLinked: graphLinked ?? Math.max(0, total - needsEdgeRepair),
    needsEdgeRepair,
    aggregatesOk,
  };
}
