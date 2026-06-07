/**
 * Backfill embedding vectors for graph ideas missing embeddings (no re-extraction).
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ConnectIngestJobRecord } from "$lib/server/connect-ingest-jobs";
import type { ConnectIngestProgressReporter } from "$lib/server/connect-ingest-progress";
import { IngestConfigError, buildJobWriter } from "$lib/server/connect/ingest-full-runner";
import type {
  GraphEmbedBackfillJobMeta,
  GraphEmbedBackfillScope,
} from "$lib/server/connect/graph-embed-backfill-job";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { formatSurrealRecordId } from "$lib/server/connect/graph-writer";
import {
  pickSurrealUnitText,
  SURREAL_GRAPH_UNIT_PAGE_SIZE,
} from "$lib/server/connect/surreal-graph-units-load";
import type { GraphStore } from "@restormel/graphrag-core";
import {
  buildEmbedStagePort,
  isConnectIngestLlmReady,
} from "$lib/server/connect/stage-route-generate";
import { resolveKnowledgeRouteExecutionContextForWorker } from "$lib/server/connect/stage-routing";
import {
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  listConnectDomainPacksForWorkspace,
  type ConnectGraphTargetRecord,
} from "$lib/server/neon";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const POSTGRES_BATCH = 2000;
const EMBED_PROCESS_BATCH = 96;

function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

export type EmbedBackfillUnit = { id: string; text: string };

async function resolveDomainPack(
  workspaceId: string,
  packId: string | null | undefined,
): Promise<ConnectDomainPack | null> {
  let packRecord = packId
    ? await getConnectDomainPackById({ id: packId, workspaceId })
    : null;
  if (!packRecord) {
    const packs = await listConnectDomainPacksForWorkspace(workspaceId);
    packRecord =
      packs.find((p) => p.slug === "philosophy") ??
      packs.find((p) => p.slug === "generic") ??
      packs[0] ??
      null;
  }
  if (!packRecord) return null;
  try {
    return domainPackRecordToApi(packRecord);
  } catch {
    return null;
  }
}

/**
 * Stream un-embedded Postgres-spine units in keyset (id-ordered) batches. Keyset
 * paging is mutation-safe: rows that gain an embedding simply drop out of the
 * `embedding IS NULL` predicate without shifting the cursor, so nothing is skipped
 * and the whole table is never held in memory at once.
 */
async function* streamPostgresUnembeddedUnits(
  workspaceId: string,
  scope: GraphEmbedBackfillScope,
  targetDimensions: number | null,
): AsyncGenerator<EmbedBackfillUnit[]> {
  const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  let lastId: string | null = null;
  const uniform = scope === "uniform_target" && targetDimensions != null && targetDimensions > 0;

  while (true) {
    const rows = (lastId
      ? uniform
        ? await sql`
            SELECT id, text
            FROM knowledge_graph_units
            WHERE workspace_id = ${workspaceId}
              AND text IS NOT NULL
              AND trim(text) != ''
              AND (embedding IS NULL OR jsonb_array_length(embedding) IS DISTINCT FROM ${targetDimensions})
              AND id > ${lastId}
            ORDER BY id ASC
            LIMIT ${POSTGRES_BATCH}
          `
        : await sql`
            SELECT id, text
            FROM knowledge_graph_units
            WHERE workspace_id = ${workspaceId}
              AND embedding IS NULL
              AND id > ${lastId}
            ORDER BY id ASC
            LIMIT ${POSTGRES_BATCH}
          `
      : uniform
        ? await sql`
            SELECT id, text
            FROM knowledge_graph_units
            WHERE workspace_id = ${workspaceId}
              AND text IS NOT NULL
              AND trim(text) != ''
              AND (embedding IS NULL OR jsonb_array_length(embedding) IS DISTINCT FROM ${targetDimensions})
            ORDER BY id ASC
            LIMIT ${POSTGRES_BATCH}
          `
        : await sql`
            SELECT id, text
            FROM knowledge_graph_units
            WHERE workspace_id = ${workspaceId}
              AND embedding IS NULL
            ORDER BY id ASC
            LIMIT ${POSTGRES_BATCH}
          `) as { id: string; text: string | null }[];

    if (!rows.length) break;
    const batch: EmbedBackfillUnit[] = [];
    for (const row of rows) {
      const text = row.text?.trim();
      if (text) batch.push({ id: row.id, text });
    }
    if (batch.length) yield batch;
    lastId = rows[rows.length - 1]!.id;
    if (rows.length < POSTGRES_BATCH) break;
  }
}

async function countPostgresEmbedWorkUnits(
  workspaceId: string,
  scope: GraphEmbedBackfillScope,
  targetDimensions: number | null,
): Promise<number> {
  const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const uniform = scope === "uniform_target" && targetDimensions != null && targetDimensions > 0;
  const rows = (uniform
    ? await sql`
        SELECT count(*)::int AS count
        FROM knowledge_graph_units
        WHERE workspace_id = ${workspaceId}
          AND text IS NOT NULL
          AND trim(text) != ''
          AND (embedding IS NULL OR jsonb_array_length(embedding) IS DISTINCT FROM ${targetDimensions})
      `
    : await sql`
        SELECT count(*)::int AS count
        FROM knowledge_graph_units
        WHERE workspace_id = ${workspaceId}
          AND embedding IS NULL
          AND text IS NOT NULL
          AND trim(text) != ''
      `) as { count: number }[];
  return Number(rows[0]?.count ?? 0);
}

export async function loadPostgresUnembeddedPreview(
  workspaceId: string,
  limit = 8,
): Promise<EmbedBackfillUnit[]> {
  const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, text
    FROM knowledge_graph_units
    WHERE workspace_id = ${workspaceId}
      AND embedding IS NULL
      AND text IS NOT NULL
      AND trim(text) != ''
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as { id: string; text: string | null }[];
  return rows
    .map((row) => {
      const text = row.text?.trim();
      return text ? { id: row.id, text: text.slice(0, 220) } : null;
    })
    .filter((row): row is EmbedBackfillUnit => row != null);
}

const SAFE_FIELD_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function vectorFieldIdent(name: string | null | undefined): string {
  return name && SAFE_FIELD_IDENT.test(name) ? name : "embedding";
}

async function countSurrealEmbedWorkUnits(
  store: GraphStore,
  unitTable: string,
  vectorField: string,
  scope: GraphEmbedBackfillScope,
  targetDimensions: number | null,
): Promise<number> {
  const uniform = scope === "uniform_target" && targetDimensions != null && targetDimensions > 0;
  try {
    const rows = await store.query<{ count?: number }[]>(
      uniform
        ? `SELECT count() AS count FROM ${unitTable} WHERE ${vectorField} IS NONE OR array::len(${vectorField}) != ${targetDimensions} GROUP ALL;`
        : `SELECT count() AS count FROM ${unitTable} WHERE ${vectorField} IS NONE GROUP ALL;`,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Drain un-embedded Surreal units one page at a time. Because each yielded page is
 * embedded (and thus leaves the `embedding IS NONE` set) before the next fetch, we
 * always re-query `START 0` rather than advancing an offset — advancing would skip
 * rows as the result set shrinks. A page that repeats unchanged (e.g. units that
 * failed to embed) stops the drain so it can never loop forever.
 */
async function* streamSurrealUnembeddedUnits(
  store: GraphStore,
  unitTable: string,
  vectorField: string,
  scope: GraphEmbedBackfillScope,
  targetDimensions: number | null,
): AsyncGenerator<EmbedBackfillUnit[]> {
  const PAGE = SURREAL_GRAPH_UNIT_PAGE_SIZE;
  let prevSignature = "";
  const uniform = scope === "uniform_target" && targetDimensions != null && targetDimensions > 0;
  const whereClause = uniform
    ? `${vectorField} IS NONE OR array::len(${vectorField}) != ${targetDimensions}`
    : `${vectorField} IS NONE`;
  while (true) {
    const rows = await store.query<
      {
        id?: string | { toString(): string };
        text?: string;
        statement?: string;
        content?: string;
      }[]
    >(`SELECT id, text, statement, content FROM ${unitTable} WHERE ${whereClause} LIMIT ${PAGE} START 0;`);
    if (!rows.length) break;

    const ids: string[] = [];
    const batch: EmbedBackfillUnit[] = [];
    for (const row of rows) {
      const id = formatSurrealRecordId(row.id);
      const text = pickSurrealUnitText(row as Record<string, unknown>);
      if (id) ids.push(id);
      if (id && text) batch.push({ id, text });
    }

    const signature = ids.join(",");
    // No forward progress since the last page → these rows aren't leaving the set
    // (already yielded + failed to embed). Stop rather than re-yield them forever.
    if (signature && signature === prevSignature) break;
    prevSignature = signature;

    if (batch.length) yield batch;
    if (rows.length < PAGE) break;
  }
}

async function countEmbedWorkUnits(args: {
  workspaceId: string;
  target: ConnectGraphTargetRecord;
  pack: ConnectDomainPack | null;
  scope: GraphEmbedBackfillScope;
  targetDimensions: number | null;
}): Promise<number> {
  if (args.target.provider === "surreal" && args.pack) {
    const store = await buildWorkspaceGraphStore(args.workspaceId);
    if (!store) return 0;
    const unitTable = tableIdent(args.pack.graph_schema.unit_table, "unit");
    const vectorField = vectorFieldIdent(args.pack.graph_schema.unit_vector_field);
    return countSurrealEmbedWorkUnits(
      store,
      unitTable,
      vectorField,
      args.scope,
      args.targetDimensions,
    );
  }
  return countPostgresEmbedWorkUnits(args.workspaceId, args.scope, args.targetDimensions);
}

/** Stream un-embedded units in memory-bounded batches from the configured store. */
async function* streamUnembeddedUnits(args: {
  workspaceId: string;
  target: ConnectGraphTargetRecord;
  pack: ConnectDomainPack | null;
  scope: GraphEmbedBackfillScope;
  targetDimensions: number | null;
}): AsyncGenerator<EmbedBackfillUnit[]> {
  if (args.target.provider === "surreal" && args.pack) {
    const store = await buildWorkspaceGraphStore(args.workspaceId);
    if (!store) return;
    const unitTable = tableIdent(args.pack.graph_schema.unit_table, "unit");
    const vectorField = vectorFieldIdent(args.pack.graph_schema.unit_vector_field);
    yield* streamSurrealUnembeddedUnits(
      store,
      unitTable,
      vectorField,
      args.scope,
      args.targetDimensions,
    );
    return;
  }
  yield* streamPostgresUnembeddedUnits(args.workspaceId, args.scope, args.targetDimensions);
}

const SKIP_STAGES = [
  "extracting",
  "relating",
  "grouping",
  "validating",
  "remediating",
] as const;

export async function runGraphEmbedBackfill(args: {
  job: ConnectIngestJobRecord;
  meta: GraphEmbedBackfillJobMeta;
  reporter: ConnectIngestProgressReporter;
}): Promise<{ embedded: number; scanned: number }> {
  const { job, meta, reporter } = args;
  const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
  if (!target) throw new IngestConfigError("graph_target_not_configured");

  const routeCtx = await resolveKnowledgeRouteExecutionContextForWorker({
    workspaceId: job.workspaceId,
    projectId: job.projectId,
  });
  const llmReady = await isConnectIngestLlmReady({
    workspaceId: job.workspaceId,
    routeCtx,
  });
  if (!llmReady || !routeCtx) {
    throw new IngestConfigError(
      "embedding_route_not_configured: publish an embedding ingestion route in AI models & keys.",
    );
  }

  const pack = await resolveDomainPack(job.workspaceId, meta.domain_pack_id ?? job.domainPackId);
  const writer = await buildJobWriter(job);
  if (!writer) throw new IngestConfigError("graph_target_not_configured");

  const scope: GraphEmbedBackfillScope = meta.scope ?? "missing_only";
  const targetDimensions =
    meta.target_dimensions ?? pack?.embedding?.dimensions ?? null;

  let cohortUnitIds: Set<string> | null = null;
  if (meta.cohort_run_id) {
    const { listReadinessRunUnitIds } = await import("$lib/server/neon");
    cohortUnitIds = new Set(await listReadinessRunUnitIds(meta.cohort_run_id));
  }

  for (const stage of SKIP_STAGES) {
    await reporter.skipStage(stage, "Skipped for embedding backfill");
  }

  const total = await countEmbedWorkUnits({
    workspaceId: job.workspaceId,
    target,
    pack,
    scope,
    targetDimensions,
  });
  if (total === 0) {
    await reporter.skipStage("embedding", "All ideas already embedded at target dimensions");
    await reporter.beginStage("storing", "Finalizing", 1);
    await reporter.completeStage("storing", "Nothing to embed");
    await reporter.complete("Embed backfill complete — 0 ideas needed vectors", "full");
    return { embedded: 0, scanned: 0 };
  }

  const embed = buildEmbedStagePort(routeCtx, meta.embedding_route_id);
  const stageLabel =
    scope === "uniform_target"
      ? `Embedding ${total} idea(s) to ${targetDimensions ?? "?"}d`
      : `Embedding ${total} missing idea(s)`;
  await reporter.beginStage("embedding", stageLabel, total);

  let embedded = 0;
  let scanned = 0;
  try {
    // Stream batches from the store so a large graph is embedded incrementally
    // instead of being loaded into memory all at once.
    for await (const page of streamUnembeddedUnits({
      workspaceId: job.workspaceId,
      target,
      pack,
      scope,
      targetDimensions,
    })) {
      for (let i = 0; i < page.length; i += EMBED_PROCESS_BATCH) {
        const sliced = page.slice(i, i + EMBED_PROCESS_BATCH);
        // Cohort runs only embed units stamped to the run.
        const batch = cohortUnitIds
          ? sliced.filter((u) => cohortUnitIds!.has(u.id))
          : sliced;
        if (batch.length === 0) continue;
        scanned += batch.length;
        await reporter.tick(
          "embedding",
          `Embedding ${Math.min(scanned, total)}/${total} idea(s)`,
        );
        const vectors = await embed(batch.map((u) => u.text));
        const pairs = batch
          .map((unit, j) => ({ unitId: unit.id, vector: vectors[j] }))
          .filter((p) => Array.isArray(p.vector) && p.vector.length > 0);
        if (pairs.length > 0) {
          embedded += await writer.setEmbeddings(pairs);
        }
      }
    }
    await reporter.completeStage("embedding", `${embedded} vector(s) stored`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Embedding failed";
    await reporter.log("EMBED", `Embedding backfill failed — ${detail}`);
    await reporter.fail("embedding", detail);
    throw err;
  }

  await reporter.beginStage("storing", "Finalizing embed backfill", 1);
  await reporter.completeStage("storing", "Embedding vectors persisted");
  await reporter.complete(
    `Embed backfill complete — ${embedded} of ${total} missing idea(s) now have vectors`,
    "full",
  );
  return { embedded, scanned };
}
