/**
 * Backfill embedding vectors for graph ideas missing embeddings (no re-extraction).
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ConnectIngestJobRecord } from "$lib/server/connect-ingest-jobs";
import type { ConnectIngestProgressReporter } from "$lib/server/connect-ingest-progress";
import { IngestConfigError, buildJobWriter } from "$lib/server/connect/ingest-full-runner";
import type { GraphEmbedBackfillJobMeta } from "$lib/server/connect/graph-embed-backfill-job";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { formatSurrealRecordId } from "$lib/server/connect/graph-writer";
import {
  paginateSurrealUnitRowsAll,
  pickSurrealUnitText,
} from "$lib/server/connect/surreal-graph-units-load";
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

export async function loadPostgresUnembeddedUnits(workspaceId: string): Promise<EmbedBackfillUnit[]> {
  const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const units: EmbedBackfillUnit[] = [];
  let lastId: string | null = null;

  while (true) {
    const rows = (lastId
      ? await sql`
          SELECT id, text
          FROM knowledge_graph_units
          WHERE workspace_id = ${workspaceId}
            AND embedding IS NULL
            AND id > ${lastId}
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
    for (const row of rows) {
      const text = row.text?.trim();
      if (text) units.push({ id: row.id, text });
    }
    lastId = rows[rows.length - 1]!.id;
    if (rows.length < POSTGRES_BATCH) break;
  }
  return units;
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

async function loadSurrealUnembeddedUnits(
  workspaceId: string,
  pack: ConnectDomainPack,
): Promise<EmbedBackfillUnit[]> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return [];
  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
  const rows = await paginateSurrealUnitRowsAll<{
    id?: string | { toString(): string };
    text?: string;
    statement?: string;
    content?: string;
  }>(store, (limit, start) =>
    `SELECT id, text, statement, content FROM ${unitTable} WHERE embedding IS NONE LIMIT ${limit} START ${start};`,
  );

  const units: EmbedBackfillUnit[] = [];
  for (const row of rows) {
    const id = formatSurrealRecordId(row.id);
    const text = pickSurrealUnitText(row as Record<string, unknown>);
    if (id && text) units.push({ id, text });
  }
  return units;
}

export async function loadUnembeddedUnits(args: {
  workspaceId: string;
  target: ConnectGraphTargetRecord;
  pack: ConnectDomainPack | null;
}): Promise<EmbedBackfillUnit[]> {
  if (args.target.provider === "surreal" && args.pack) {
    return loadSurrealUnembeddedUnits(args.workspaceId, args.pack);
  }
  return loadPostgresUnembeddedUnits(args.workspaceId);
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

  for (const stage of SKIP_STAGES) {
    await reporter.skipStage(stage, "Skipped for embedding backfill");
  }

  const units = await loadUnembeddedUnits({ workspaceId: job.workspaceId, target, pack });
  if (units.length === 0) {
    await reporter.skipStage("embedding", "All ideas already embedded");
    await reporter.beginStage("storing", "Finalizing", 1);
    await reporter.completeStage("storing", "Nothing to embed");
    await reporter.complete("Embed backfill complete — 0 ideas needed vectors", "full");
    return { embedded: 0, scanned: 0 };
  }

  const embed = buildEmbedStagePort(routeCtx, meta.embedding_route_id);
  await reporter.beginStage("embedding", `Embedding ${units.length} missing idea(s)`, units.length);

  let embedded = 0;
  try {
    for (let i = 0; i < units.length; i += EMBED_PROCESS_BATCH) {
      const batch = units.slice(i, i + EMBED_PROCESS_BATCH);
      await reporter.tick(
        "embedding",
        `Embedding batch ${Math.floor(i / EMBED_PROCESS_BATCH) + 1} — ${Math.min(i + batch.length, units.length)}/${units.length}`,
      );
      const vectors = await embed(batch.map((u) => u.text));
      const pairs = batch
        .map((unit, j) => ({ unitId: unit.id, vector: vectors[j] }))
        .filter((p) => Array.isArray(p.vector) && p.vector.length > 0);
      if (pairs.length > 0) {
        embedded += await writer.setEmbeddings(pairs);
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
    `Embed backfill complete — ${embedded} of ${units.length} missing idea(s) now have vectors`,
    "full",
  );
  return { embedded, scanned: units.length };
}
