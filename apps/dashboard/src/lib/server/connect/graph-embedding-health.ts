/**
 * Embedding coverage and dimension uniformity for Connect graph readiness.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import {
  detectEmbeddedUnits,
  VECTOR_FIELD_CANDIDATES,
} from "$lib/server/connect/surreal-graph-units-load";
import {
  domainPackRecordToApi,
  getSelectedDomainPackId,
} from "$lib/server/connect/domain-pack-service";
import {
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  listConnectDomainPacksForWorkspace,
} from "$lib/server/neon";

export type EmbeddingDimensionBucket = { dimensions: number; count: number };

export type GraphEmbeddingHealth = {
  totalUnits: number;
  embeddedCount: number;
  unembeddedCount: number;
  targetDimensions: number;
  dimensionBuckets: EmbeddingDimensionBucket[];
  dominantDimension: number | null;
  hasMixedDimensions: boolean;
  mismatchedDimensionCount: number;
  workCount: number;
  actionNeeded: boolean;
  actionReason: "missing" | "mixed" | "wrong_dimension" | "none";
  vectorField: string | null;
};

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SAFE_FIELD_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

function vectorFieldIdent(name: string | null | undefined): string {
  return name && SAFE_FIELD_IDENT.test(name) ? name : "embedding";
}

async function resolvePackForHealth(workspaceId: string): Promise<ConnectDomainPack | null> {
  const selectedId = await getSelectedDomainPackId(workspaceId).catch(() => null);
  if (selectedId) {
    const row = await getConnectDomainPackById({ id: selectedId, workspaceId }).catch(() => null);
    if (row) {
      try {
        return domainPackRecordToApi(row);
      } catch {
        // fall through
      }
    }
  }
  const rows = await listConnectDomainPacksForWorkspace(workspaceId);
  const pick = rows.find((r) => r.slug === "generic") ?? rows[0] ?? null;
  if (!pick) return null;
  try {
    return domainPackRecordToApi(pick);
  } catch {
    return null;
  }
}

export function deriveEmbeddingAction(args: {
  unembeddedCount: number;
  mismatchedDimensionCount: number;
  hasMixedDimensions: boolean;
  dominantDimension: number | null;
  targetDimensions: number;
  embeddedCount: number;
}): Pick<GraphEmbeddingHealth, "actionNeeded" | "actionReason" | "workCount"> {
  const workCount = args.unembeddedCount + args.mismatchedDimensionCount;
  if (workCount === 0) {
    return { actionNeeded: false, actionReason: "none", workCount: 0 };
  }
  if (args.unembeddedCount > 0 && (args.mismatchedDimensionCount > 0 || args.hasMixedDimensions)) {
    return { actionNeeded: true, actionReason: "mixed", workCount };
  }
  if (args.unembeddedCount > 0) {
    return { actionNeeded: true, actionReason: "missing", workCount };
  }
  if (args.hasMixedDimensions || args.mismatchedDimensionCount > 0) {
    return { actionNeeded: true, actionReason: "mixed", workCount };
  }
  if (args.embeddedCount > 0 && args.dominantDimension !== args.targetDimensions) {
    return { actionNeeded: true, actionReason: "wrong_dimension", workCount };
  }
  return { actionNeeded: true, actionReason: "wrong_dimension", workCount };
}

async function postgresEmbeddingHealth(
  workspaceId: string,
  totalUnits: number,
  embeddedCount: number,
  targetDimensions: number,
): Promise<
  Omit<GraphEmbeddingHealth, "totalUnits" | "embeddedCount" | "targetDimensions">
> {
  const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
  await ensureIngestionRoutingSchema();
  const sql = getSql();

  const [unembeddedRows, bucketRows, mismatchedRows] = await Promise.all([
    sql`
      SELECT count(*)::int AS count
      FROM knowledge_graph_units
      WHERE workspace_id = ${workspaceId}
        AND embedding IS NULL
        AND text IS NOT NULL
        AND trim(text) != ''
    ` as unknown as Promise<{ count: number }[]>,
    sql`
      SELECT jsonb_array_length(embedding)::int AS dimensions, count(*)::int AS count
      FROM knowledge_graph_units
      WHERE workspace_id = ${workspaceId} AND embedding IS NOT NULL
      GROUP BY dimensions
      ORDER BY count DESC
    ` as unknown as Promise<{ dimensions: number | null; count: number }[]>,
    sql`
      SELECT count(*)::int AS count
      FROM knowledge_graph_units
      WHERE workspace_id = ${workspaceId}
        AND text IS NOT NULL
        AND trim(text) != ''
        AND embedding IS NOT NULL
        AND jsonb_array_length(embedding) IS DISTINCT FROM ${targetDimensions}
    ` as unknown as Promise<{ count: number }[]>,
  ]);

  const unembeddedCount = Number(unembeddedRows[0]?.count ?? 0);
  const dimensionBuckets = bucketRows
    .map((row) => ({
      dimensions: Number(row.dimensions ?? 0),
      count: Number(row.count ?? 0),
    }))
    .filter((row) => row.dimensions > 0 && row.count > 0);
  const dominantDimension = dimensionBuckets[0]?.dimensions ?? null;
  const hasMixedDimensions = dimensionBuckets.length > 1;
  const mismatchedDimensionCount = Number(mismatchedRows[0]?.count ?? 0);
  const action = deriveEmbeddingAction({
    unembeddedCount,
    mismatchedDimensionCount,
    hasMixedDimensions,
    dominantDimension,
    targetDimensions,
    embeddedCount,
  });

  return {
    unembeddedCount,
    dimensionBuckets,
    dominantDimension,
    hasMixedDimensions,
    mismatchedDimensionCount,
    vectorField: null,
    ...action,
  };
}

async function surrealDimensionBuckets(
  store: GraphStore,
  unitTable: string,
  vectorField: string,
): Promise<EmbeddingDimensionBucket[]> {
  const fields = [vectorField, ...VECTOR_FIELD_CANDIDATES.filter((f) => f !== vectorField)];
  for (const field of fields) {
    try {
      const rows = await store.query<{ dimensions?: number; count?: number }[]>(
        `SELECT array::len(${field}) AS dimensions, count() AS count FROM ${unitTable} WHERE ${field} IS NOT NONE GROUP BY dimensions;`,
      );
      const buckets = rows
        .map((row) => ({
          dimensions: Number(row.dimensions ?? 0),
          count: Number(row.count ?? 0),
        }))
        .filter((row) => row.dimensions > 0 && row.count > 0)
        .sort((a, b) => b.count - a.count);
      if (buckets.length > 0) return buckets;
    } catch {
      // try next field
    }
  }
  return [];
}

async function surrealMismatchedCount(
  store: GraphStore,
  unitTable: string,
  vectorField: string,
  targetDimensions: number,
): Promise<number> {
  try {
    const rows = await store.query<{ count?: number }[]>(
      `SELECT count() AS count FROM ${unitTable} WHERE ${vectorField} IS NOT NONE AND array::len(${vectorField}) != ${targetDimensions} GROUP ALL;`,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function surrealUnembeddedCount(
  store: GraphStore,
  unitTable: string,
  vectorField: string,
): Promise<number> {
  try {
    const rows = await store.query<{ count?: number }[]>(
      `SELECT count() AS count FROM ${unitTable} WHERE ${vectorField} IS NONE GROUP ALL;`,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function sampleSurrealEmbeddingDimension(
  store: GraphStore,
  unitTable: string,
  vectorField: string,
): Promise<number | null> {
  try {
    const rows = await store.query<{ dim?: number }[]>(
      `SELECT array::len(${vectorField}) AS dim FROM ${unitTable} WHERE ${vectorField} IS NOT NONE LIMIT 1;`,
    );
    const dim = rows[0]?.dim;
    return typeof dim === "number" && dim > 0 ? dim : null;
  } catch {
    return null;
  }
}

async function surrealEmbeddingHealth(
  workspaceId: string,
  pack: ConnectDomainPack,
  totalUnits: number,
  embeddedCount: number,
  targetDimensions: number,
  opts?: { fast?: boolean },
): Promise<
  Omit<GraphEmbeddingHealth, "totalUnits" | "embeddedCount" | "targetDimensions">
> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) {
    return {
      unembeddedCount: Math.max(0, totalUnits - embeddedCount),
      dimensionBuckets: [],
      dominantDimension: null,
      hasMixedDimensions: false,
      mismatchedDimensionCount: 0,
      workCount: Math.max(0, totalUnits - embeddedCount),
      actionNeeded: embeddedCount < totalUnits,
      actionReason: embeddedCount < totalUnits ? "missing" : "none",
      vectorField: vectorFieldIdent(pack.graph_schema.unit_vector_field),
    };
  }

  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
  const vectorField = vectorFieldIdent(pack.graph_schema.unit_vector_field);

  if (opts?.fast) {
    const unembeddedCount = Math.max(0, totalUnits - embeddedCount);
    const sampledDimension = embeddedCount > 0
      ? await sampleSurrealEmbeddingDimension(store, unitTable, vectorField)
      : null;
    const mismatchedDimensionCount =
      sampledDimension != null && sampledDimension !== targetDimensions ? embeddedCount : 0;
    const action = deriveEmbeddingAction({
      unembeddedCount,
      mismatchedDimensionCount,
      hasMixedDimensions: false,
      dominantDimension: sampledDimension,
      targetDimensions,
      embeddedCount,
    });
    return {
      unembeddedCount,
      dimensionBuckets: sampledDimension
        ? [{ dimensions: sampledDimension, count: embeddedCount }]
        : [],
      dominantDimension: sampledDimension,
      hasMixedDimensions: false,
      mismatchedDimensionCount,
      vectorField,
      ...action,
    };
  }

  const embedDetect = await detectEmbeddedUnits(store, unitTable, pack.graph_schema.unit_vector_field);
  const resolvedVectorField = embedDetect.field;

  const [unembeddedCount, dimensionBuckets, mismatchedDimensionCount] = await Promise.all([
    surrealUnembeddedCount(store, unitTable, resolvedVectorField),
    surrealDimensionBuckets(store, unitTable, resolvedVectorField),
    surrealMismatchedCount(store, unitTable, resolvedVectorField, targetDimensions),
  ]);

  const dominantDimension = dimensionBuckets[0]?.dimensions ?? null;
  const hasMixedDimensions = dimensionBuckets.length > 1;
  const action = deriveEmbeddingAction({
    unembeddedCount,
    mismatchedDimensionCount,
    hasMixedDimensions,
    dominantDimension,
    targetDimensions,
    embeddedCount,
  });

  return {
    unembeddedCount,
    dimensionBuckets,
    dominantDimension,
    hasMixedDimensions,
    mismatchedDimensionCount,
    vectorField: resolvedVectorField,
    ...action,
  };
}

async function postgresEmbeddingHealthFast(
  workspaceId: string,
  totalUnits: number,
  embeddedCount: number,
  targetDimensions: number,
): Promise<
  Omit<GraphEmbeddingHealth, "totalUnits" | "embeddedCount" | "targetDimensions">
> {
  const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const unembeddedCount = Math.max(0, totalUnits - embeddedCount);
  let sampledDimension: number | null = null;
  if (embeddedCount > 0) {
    const sampleRows = (await sql`
      SELECT jsonb_array_length(embedding)::int AS dimensions
      FROM knowledge_graph_units
      WHERE workspace_id = ${workspaceId} AND embedding IS NOT NULL
      LIMIT 1
    `) as { dimensions: number | null }[];
    sampledDimension = Number(sampleRows[0]?.dimensions ?? 0) || null;
  }
  const mismatchedDimensionCount =
    sampledDimension != null && sampledDimension !== targetDimensions ? embeddedCount : 0;
  const action = deriveEmbeddingAction({
    unembeddedCount,
    mismatchedDimensionCount,
    hasMixedDimensions: false,
    dominantDimension: sampledDimension,
    targetDimensions,
    embeddedCount,
  });
  return {
    unembeddedCount,
    dimensionBuckets: sampledDimension
      ? [{ dimensions: sampledDimension, count: embeddedCount }]
      : [],
    dominantDimension: sampledDimension,
    hasMixedDimensions: false,
    mismatchedDimensionCount,
    vectorField: null,
    ...action,
  };
}

export type GraphEmbeddingHealthAuditOpts = {
  /** Skip full-table Surreal/Postgres scans — use cached stats + a single vector sample. */
  fast?: boolean;
};

export async function auditGraphEmbeddingHealth(
  workspaceId: string,
  stats?: { units: number; embedded: number } | null,
  opts?: GraphEmbeddingHealthAuditOpts,
): Promise<GraphEmbeddingHealth | null> {
  const [target, pack, resolvedStats] = await Promise.all([
    getConnectGraphTargetForWorkspace(workspaceId),
    resolvePackForHealth(workspaceId),
    stats
      ? Promise.resolve(stats)
      : import("$lib/server/connect/graph-explorer-service").then((m) =>
          m.resolveConnectGraphStats(workspaceId).catch(() => null),
        ),
  ]);

  if (!target || !resolvedStats || resolvedStats.units === 0) return null;

  const targetDimensions = pack?.embedding?.dimensions ?? 1024;
  const totalUnits = resolvedStats.units;
  const embeddedCount = resolvedStats.embedded;

  const tail =
    target.provider === "surreal" && pack
      ? await surrealEmbeddingHealth(
          workspaceId,
          pack,
          totalUnits,
          embeddedCount,
          targetDimensions,
          opts,
        )
      : opts?.fast
        ? await postgresEmbeddingHealthFast(workspaceId, totalUnits, embeddedCount, targetDimensions)
        : await postgresEmbeddingHealth(workspaceId, totalUnits, embeddedCount, targetDimensions);

  return {
    totalUnits,
    embeddedCount,
    targetDimensions,
    ...tail,
  };
}
