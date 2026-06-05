/**
 * Automated repair: match graph ideas to the best available source text and update provenance.
 */
import type { ConnectDomainPack, ConnectGraphLinkSourcesScope } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import type { ConnectIngestJobRecord } from "$lib/server/connect-ingest-jobs";
import type { ConnectIngestProgressReporter } from "$lib/server/connect-ingest-progress";
import { IngestConfigError, buildJobWriter } from "$lib/server/connect/ingest-full-runner";
import type { GraphLinkSourcesJobMeta } from "$lib/server/connect/graph-source-link-job";
import {
  fetchSurrealSourceRecordText,
  resolveConnectSourceText,
} from "$lib/server/connect/connect-source-text-resolve";
import {
  pickBestSourceMatch,
  unitNeedsSourceLink,
} from "$lib/server/connect/graph-source-link-matcher";
import { formatSurrealRecordId, surrealRecordRef } from "$lib/server/connect/graph-writer";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import {
  paginateSurrealUnitRows,
  pickSurrealUnitText,
  surrealRevalidateUnitsQuery,
} from "$lib/server/connect/surreal-graph-units-load";
import {
  countGraphUnitsNeedingSourceLink,
  findConnectGraphSourceByTitleOrUrl,
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  insertConnectGraphSourcePostgres,
  listConnectGraphSourcesForWorkspace,
  listConnectIngestJobsForWorkspace,
  listParsedConnectSourceDocumentTextsForWorkspace,
  updateUnitSourcePostgres,
  type ConnectGraphTargetRecord,
} from "$lib/server/neon";
import { listConnectDomainPacksForWorkspace } from "$lib/server/neon";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

type LinkUnitRow = {
  id: string;
  text: string;
  sourceKey: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceKind: string | null;
  textPreview: string | null;
};

type LinkCandidate = {
  graphSourceId: string;
  title: string;
  url: string | null;
  text: string;
  textPreview: string | null;
};

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

function parseJobSources(raw: unknown): { title?: string; url?: string; text?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        ...(typeof rec.title === "string" ? { title: rec.title } : {}),
        ...(typeof rec.url === "string" ? { url: rec.url } : {}),
        ...(typeof rec.text === "string" ? { text: rec.text } : {}),
      };
    })
    .filter((s) => s.text?.trim());
}

async function loadPostgresLinkUnits(workspaceId: string): Promise<LinkUnitRow[]> {
  const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      u.id,
      u.text,
      s.id AS source_id,
      s.title AS source_title,
      s.url AS source_url,
      s.source_kind,
      s.text_preview
    FROM knowledge_graph_units u
    JOIN knowledge_graph_sources s
      ON s.id = u.source_id AND s.workspace_id = u.workspace_id
    WHERE u.workspace_id = ${workspaceId}
    ORDER BY u.created_at ASC
    LIMIT 5000
  `) as {
    id: string;
    text: string;
    source_id: string;
    source_title: string | null;
    source_url: string | null;
    source_kind: string | null;
    text_preview: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    sourceKey: row.source_id,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    sourceKind: row.source_kind,
    textPreview: row.text_preview,
  }));
}

async function loadSurrealLinkUnits(
  workspaceId: string,
  pack: ConnectDomainPack,
): Promise<LinkUnitRow[]> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return [];

  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
  const rows = await paginateSurrealUnitRows<Record<string, unknown>>(
    store,
    (limit, start, fetchSource) =>
      surrealRevalidateUnitsQuery(unitTable, limit, start, fetchSource),
  );

  const units: LinkUnitRow[] = [];
  for (const row of rows) {
    const text = pickSurrealUnitText(row);
    if (!text) continue;
    const id =
      formatSurrealRecordId(row.id) ?? (typeof row.id === "string" ? row.id : null);
    if (!id) continue;

    let sourceKey: string | null = null;
    let sourceTitle: string | null = null;
    let sourceUrl: string | null = null;
    let textPreview: string | null = null;
    let sourceKind: string | null = null;

    const source = row.source;
    if (typeof source === "string" && source.includes(":")) {
      sourceKey = source;
    } else if (source && typeof source === "object" && !Array.isArray(source)) {
      const s = source as Record<string, unknown>;
      sourceKey =
        formatSurrealRecordId(s.id) ?? (typeof s.id === "string" ? s.id : null);
      sourceTitle = typeof s.title === "string" ? s.title : null;
      sourceUrl = typeof s.url === "string" ? s.url : null;
      textPreview = typeof s.text_preview === "string" ? s.text_preview : null;
      sourceKind = typeof s.source_kind === "string" ? s.source_kind : null;
    }
    if (typeof row.source_title === "string") sourceTitle = row.source_title;
    if (typeof row.source_url === "string") sourceUrl = row.source_url;

    units.push({
      id,
      text,
      sourceKey,
      sourceTitle,
      sourceUrl,
      sourceKind,
      textPreview,
    });
  }
  return units;
}

async function loadSurrealGraphSources(
  store: GraphStore,
  pack: ConnectDomainPack,
): Promise<
  {
    id: string;
    title: string | null;
    url: string | null;
    textPreview: string | null;
    sourceKind: string | null;
    fullText: string | null;
  }[]
> {
  const sourceTable = tableIdent(pack.graph_schema.source_table, "source");
  try {
    const rows = await store.query<Record<string, unknown>[]>(
      `SELECT id, title, url, text_preview, source_kind, text, body, content FROM ${sourceTable} LIMIT 500;`,
    );
    return rows
      .map((row) => {
        const id =
          formatSurrealRecordId(row.id) ?? (typeof row.id === "string" ? row.id : null);
        if (!id) return null;
        const fullText =
          (typeof row.text === "string" && row.text.trim()) ||
          (typeof row.body === "string" && row.body.trim()) ||
          (typeof row.content === "string" && row.content.trim()) ||
          null;
        return {
          id,
          title: typeof row.title === "string" ? row.title : null,
          url: typeof row.url === "string" ? row.url : null,
          textPreview: typeof row.text_preview === "string" ? row.text_preview : null,
          sourceKind: typeof row.source_kind === "string" ? row.source_kind : null,
          fullText,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  } catch {
    return [];
  }
}

async function ensurePostgresGraphSourceId(params: {
  workspaceId: string;
  domainPackId: string | null;
  jobId: string;
  title: string;
  url: string | null;
  textPreview: string | null;
  sourceKind: string;
}): Promise<string> {
  const existing = await findConnectGraphSourceByTitleOrUrl({
    workspaceId: params.workspaceId,
    title: params.title,
    url: params.url,
  });
  if (existing) return existing;
  return insertConnectGraphSourcePostgres({
    workspaceId: params.workspaceId,
    domainPackId: params.domainPackId,
    jobId: params.jobId,
    title: params.title,
    url: params.url,
    textPreview: params.textPreview,
    sourceKind: params.sourceKind,
  });
}

async function buildLinkCandidateCatalog(args: {
  workspaceId: string;
  job: ConnectIngestJobRecord;
  pack: ConnectDomainPack | null;
  surrealStore: GraphStore | null;
  target: ConnectGraphTargetRecord;
  registerSource: (s: {
    title: string;
    url: string | null;
    textPreview: string | null;
    sourceKind: string;
  }) => Promise<string>;
}): Promise<LinkCandidate[]> {
  const byId = new Map<string, LinkCandidate>();

  if (args.target.provider === "surreal" && args.surrealStore && args.pack) {
    const surrealSources = await loadSurrealGraphSources(args.surrealStore, args.pack);
    for (const src of surrealSources) {
      const resolved = await resolveConnectSourceText({
        workspaceId: args.workspaceId,
        title: src.title,
        url: src.url,
        textPreview: src.textPreview,
        surrealFullText: src.fullText,
      });
      const text = resolved.text.trim() || src.fullText?.trim() || "";
      if (!text) continue;
      byId.set(src.id, {
        graphSourceId: src.id,
        title: src.title ?? "Source",
        url: src.url,
        text,
        textPreview: src.textPreview ?? text.slice(0, 500),
      });
    }
  } else {
    const graphSources = await listConnectGraphSourcesForWorkspace(args.workspaceId);
    for (const src of graphSources) {
      const resolved = await resolveConnectSourceText({
        workspaceId: args.workspaceId,
        title: src.title,
        url: src.url,
        textPreview: src.textPreview,
      });
      if (!resolved.text.trim()) continue;
      byId.set(src.id, {
        graphSourceId: src.id,
        title: src.title ?? "Source",
        url: src.url,
        text: resolved.text,
        textPreview: src.textPreview ?? resolved.text.slice(0, 500),
      });
    }
  }

  const parsedDocs = await listParsedConnectSourceDocumentTextsForWorkspace(args.workspaceId, 200);
  for (const doc of parsedDocs) {
    const title = doc.name?.trim() || doc.url || "Pipeline source";
    const preview = doc.text.slice(0, 500);
    const graphSourceId =
      args.target.provider === "postgres"
        ? await ensurePostgresGraphSourceId({
            workspaceId: args.workspaceId,
            domainPackId: args.job.domainPackId,
            jobId: args.job.id,
            title,
            url: doc.url,
            textPreview: preview,
            sourceKind: "document",
          })
        : await args.registerSource({
            title,
            url: doc.url,
            textPreview: preview,
            sourceKind: "document",
          });
    if (!byId.has(graphSourceId)) {
      byId.set(graphSourceId, {
        graphSourceId,
        title,
        url: doc.url,
        text: doc.text,
        textPreview: preview,
      });
    }
  }

  const jobs = await listConnectIngestJobsForWorkspace({ workspaceId: args.workspaceId, limit: 30 });
  for (const ingestJob of jobs) {
    for (const src of parseJobSources(ingestJob.sources)) {
      const title = src.title?.trim() || src.url || "Ingest source";
      const text = src.text!.trim();
      const preview = text.slice(0, 500);
      const graphSourceId =
        args.target.provider === "postgres"
          ? await ensurePostgresGraphSourceId({
              workspaceId: args.workspaceId,
              domainPackId: args.job.domainPackId,
              jobId: args.job.id,
              title,
              url: src.url ?? null,
              textPreview: preview,
              sourceKind: src.url ? "url" : "text",
            })
          : await args.registerSource({
              title,
              url: src.url ?? null,
              textPreview: preview,
              sourceKind: src.url ? "url" : "text",
            });
      const existing = byId.get(graphSourceId);
      if (!existing || existing.text.length < text.length) {
        byId.set(graphSourceId, {
          graphSourceId,
          title,
          url: src.url ?? null,
          text,
          textPreview: preview,
        });
      }
    }
  }

  return [...byId.values()];
}

async function applySurrealUnitSource(
  store: GraphStore,
  unitId: string,
  sourceId: string,
): Promise<void> {
  await store.query(
    `UPDATE ${surrealRecordRef(unitId)} MERGE { source: ${surrealRecordRef(sourceId)} };`,
  );
}

const SKIP_STAGES = [
  "extracting",
  "relating",
  "grouping",
  "embedding",
  "validating",
  "remediating",
] as const;

export async function runGraphSourceLinking(args: {
  job: ConnectIngestJobRecord;
  meta: GraphLinkSourcesJobMeta;
  reporter: ConnectIngestProgressReporter;
}): Promise<{ linked: number; scanned: number; candidates: number }> {
  const { job, meta, reporter } = args;
  const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
  if (!target) throw new IngestConfigError("graph_target_not_configured");

  const pack = await resolveDomainPack(job.workspaceId, meta.domain_pack_id ?? job.domainPackId);
  const writer = await buildJobWriter(job);
  if (!writer) throw new IngestConfigError("graph_target_not_configured");

  const surrealStore =
    target.provider === "surreal" ? await buildWorkspaceGraphStore(job.workspaceId) : null;

  for (const stage of SKIP_STAGES) {
    await reporter.skipStage(stage, "Skipped for automated source linking");
  }

  await reporter.beginStage("storing", "Loading ideas and source catalog", 1);
  const units =
    target.provider === "surreal" && pack
      ? await loadSurrealLinkUnits(job.workspaceId, pack)
      : await loadPostgresLinkUnits(job.workspaceId);

  if (units.length === 0) {
    await reporter.completeStage("storing", "No ideas found in graph store");
    await reporter.complete("Source linking complete — 0 ideas scanned", "full");
    return { linked: 0, scanned: 0, candidates: 0 };
  }

  const candidates = await buildLinkCandidateCatalog({
    workspaceId: job.workspaceId,
    job,
    pack,
    surrealStore,
    target,
    registerSource: (s) => writer.writeSource(s),
  });

  if (candidates.length === 0) {
    await reporter.completeStage(
      "storing",
      "No source text found — add documents in Pipeline → Sources or re-run ingest",
    );
    await reporter.complete("Source linking complete — no candidates", "full");
    return { linked: 0, scanned: units.length, candidates: 0 };
  }

  await reporter.beginStage(
    "storing",
    `Matching ${units.length} idea(s) against ${candidates.length} source(s)`,
    Math.max(1, units.length),
  );

  let linked = 0;
  let skipped = 0;
  let scanned = 0;

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i]!;
    scanned += 1;
    if (i % 25 === 0) {
      await reporter.tick("storing", `Scanned ${i + 1}/${units.length} ideas`);
    }

    const surrealHints =
      surrealStore && unit.sourceKey?.includes(":")
        ? await fetchSurrealSourceRecordText(surrealStore, unit.sourceKey)
        : null;

    const resolved = await resolveConnectSourceText({
      workspaceId: job.workspaceId,
      title: unit.sourceTitle ?? surrealHints?.title ?? null,
      url: unit.sourceUrl ?? surrealHints?.url ?? null,
      textPreview: unit.textPreview ?? surrealHints?.textPreview ?? null,
      surrealFullText: surrealHints?.fullText ?? null,
    });

    const needsLink =
      meta.scope === "all" ||
      unitNeedsSourceLink({
        sourceKind: unit.sourceKind,
        sourceTitle: unit.sourceTitle,
        sourceUrl: unit.sourceUrl,
        resolvedQuality: resolved.quality,
      });

    if (!needsLink) {
      skipped += 1;
      continue;
    }

    const match = pickBestSourceMatch(unit.text, candidates);
    if (!match) {
      skipped += 1;
      continue;
    }

    if (
      unit.sourceKey &&
      unit.sourceKey === match.candidate.graphSourceId &&
      !unitNeedsSourceLink({
        sourceKind: unit.sourceKind,
        sourceTitle: unit.sourceTitle,
        sourceUrl: unit.sourceUrl,
        resolvedQuality: resolved.quality,
      })
    ) {
      skipped += 1;
      continue;
    }

    if (target.provider === "surreal" && surrealStore) {
      await applySurrealUnitSource(surrealStore, unit.id, match.candidate.graphSourceId);
    } else {
      await updateUnitSourcePostgres({
        workspaceId: job.workspaceId,
        unitId: unit.id,
        sourceId: match.candidate.graphSourceId,
      });
    }
    linked += 1;
  }

  await reporter.completeStage(
    "storing",
    `Linked ${linked} idea(s); ${skipped} unchanged or unmatched`,
  );
  await reporter.complete(
    `Source linking complete — ${linked} linked, ${scanned} scanned, ${candidates.length} sources in catalog`,
    "full",
  );
  return { linked, scanned, candidates: candidates.length };
}

/** Lightweight stats for graph explorer Tools panel. */
export async function summarizeGraphSourceLinkNeed(workspaceId: string): Promise<{
  unitsNeedingLink: number;
}> {
  return { unitsNeedingLink: await countGraphUnitsNeedingSourceLink(workspaceId) };
}
