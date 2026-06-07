/**
 * Automated repair: match graph ideas to the best available source text and update provenance.
 */
import type { ConnectDomainPack, ConnectGraphLinkSourcesScope } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import type { ConnectIngestJobRecord } from "$lib/server/connect-ingest-jobs";
import type { ConnectIngestProgressReporter } from "$lib/server/connect-ingest-progress";
import { IngestConfigError, buildJobWriter } from "$lib/server/connect/ingest-full-runner";
import type { GraphLinkSourcesJobMeta } from "$lib/server/connect/graph-source-link-job";
import { resolveConnectSourceText } from "$lib/server/connect/connect-source-text-resolve";
import { isUncheckedValidationStatus } from "$lib/connect/validation-status";
import {
  inferSourceTextQualityForLink,
  pickBestPreparedSourceMatch,
  prepareSourceMatchCandidates,
  unitNeedsSourceLink,
} from "$lib/server/connect/graph-source-link-matcher";
import { formatSurrealRecordId, surrealRecordRef } from "$lib/server/connect/graph-writer";
import { resolveWorkspaceDomainPack } from "$lib/server/connect/domain-pack-service";
import {
  buildSourceSelectClause,
  extractInlineSourceText,
  resolveSurrealSourceFullText,
} from "$lib/server/connect/surreal-source-text";
import { peekConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import {
  loadSurrealProvenanceAggregateCounts,
  resolveSurrealUnitTableForProvenance,
} from "$lib/server/connect/graph-surreal-provenance-counts";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import {
  pickSurrealUnitText,
  streamSurrealUnitRowsAll,
  surrealRevalidateUnitsQuery,
  surrealSourceLinkUnitsQuery,
} from "$lib/server/connect/surreal-graph-units-load";
import {
  countGraphUnitsNeedingSourceLink,
  findConnectGraphSourceByTitleOrUrl,
  getConnectGraphTargetForWorkspace,
  insertConnectGraphSourcePostgres,
  listConnectGraphSourcesForWorkspace,
  listConnectIngestJobsForWorkspace,
  listParsedConnectSourceDocumentTextsForWorkspace,
  updateUnitSourcePostgres,
  type ConnectGraphTargetRecord,
} from "$lib/server/neon";
const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
/** Surreal UPDATE statements per HTTP /sql request during source linking. */
const SURREAL_LINK_UPDATE_BATCH = 16;
/** Max time to spend counting units needing link for the options API (large BYO graphs). */
const LINK_OPTIONS_COUNT_BUDGET_MS = 12_000;
/** Progress log + ETA refresh interval (ideas scanned between ticks). */
const LINK_PROGRESS_TICK_EVERY = 500;
/** Parallel Surreal passage/text resolutions while building the source catalog. */
const SOURCE_CATALOG_RESOLVE_CONCURRENCY = 16;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return out;
}

function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

/** Surreal record id stored when graph-import copies a bibliographic source into the pipeline catalog. */
export function graphSourceKeyFromProvenance(
  provenance: Record<string, unknown> | null | undefined,
): string | null {
  const key = provenance?.graph_source_key;
  return typeof key === "string" && key.includes(":") ? key : null;
}

async function surrealSourceRecordExists(store: GraphStore, sourceId: string): Promise<boolean> {
  try {
    const rows = await store.query<Record<string, unknown>[]>(
      `SELECT id FROM ${surrealRecordRef(sourceId)} LIMIT 1;`,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function findSurrealGraphSourceByTitleOrUrl(
  store: GraphStore,
  pack: ConnectDomainPack,
  title: string | null,
  url: string | null,
): Promise<string | null> {
  const sourceTable = tableIdent(pack.graph_schema.source_table, "source");
  const urlTrim = url?.trim();
  if (urlTrim) {
    try {
      const rows = await store.query<Record<string, unknown>[]>(
        `SELECT id FROM ${sourceTable} WHERE url = ${JSON.stringify(urlTrim)} LIMIT 1;`,
      );
      const id =
        rows[0] != null
          ? formatSurrealRecordId(rows[0].id) ??
            (typeof rows[0].id === "string" ? rows[0].id : null)
          : null;
      if (id) return id;
    } catch {
      // schema may not define url — fall through to title
    }
  }
  const titleTrim = title?.trim();
  if (titleTrim) {
    try {
      const rows = await store.query<Record<string, unknown>[]>(
        `SELECT id FROM ${sourceTable} WHERE title = ${JSON.stringify(titleTrim)} LIMIT 1;`,
      );
      const id =
        rows[0] != null
          ? formatSurrealRecordId(rows[0].id) ??
            (typeof rows[0].id === "string" ? rows[0].id : null)
          : null;
      if (id) return id;
    } catch {
      return null;
    }
  }
  return null;
}

async function ensureSurrealGraphSourceId(args: {
  store: GraphStore;
  pack: ConnectDomainPack;
  graphSourceKey?: string | null;
  title: string;
  url: string | null;
  textPreview: string | null;
  sourceKind: string;
  registerSource: (s: {
    title: string;
    url: string | null;
    textPreview: string | null;
    sourceKind: string;
  }) => Promise<string>;
}): Promise<string> {
  const graphKey = args.graphSourceKey?.trim();
  if (graphKey && (await surrealSourceRecordExists(args.store, graphKey))) {
    return graphKey;
  }
  const existing = await findSurrealGraphSourceByTitleOrUrl(
    args.store,
    args.pack,
    args.title,
    args.url,
  );
  if (existing) return existing;
  return args.registerSource({
    title: args.title,
    url: args.url,
    textPreview: args.textPreview,
    sourceKind: args.sourceKind,
  });
}

type LinkUnitRow = {
  id: string;
  text: string;
  sourceKey: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceKind: string | null;
  textPreview: string | null;
  sourceInlineText: string | null;
};

type LinkCandidate = {
  graphSourceId: string;
  title: string;
  url: string | null;
  text: string;
  textPreview: string | null;
};

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
    sourceInlineText: null,
  }));
}

function mapSurrealRowToLinkUnit(row: Record<string, unknown>): LinkUnitRow | null {
  const text = pickSurrealUnitText(row);
  if (!text) return null;
  const id = formatSurrealRecordId(row.id) ?? (typeof row.id === "string" ? row.id : null);
  if (!id) return null;

  let sourceKey: string | null = null;
  let sourceTitle: string | null = null;
  let sourceUrl: string | null = null;
  let textPreview: string | null = null;
  let sourceKind: string | null = null;
  let sourceInlineText: string | null = null;

  const source = row.source;
  if (typeof source === "string" && source.includes(":")) {
    sourceKey = source;
  } else if (source && typeof source === "object" && !Array.isArray(source)) {
    const s = source as Record<string, unknown>;
    sourceKey = formatSurrealRecordId(s.id) ?? (typeof s.id === "string" ? s.id : null);
    sourceTitle = typeof s.title === "string" ? s.title : null;
    sourceUrl = typeof s.url === "string" ? s.url : null;
    textPreview = typeof s.text_preview === "string" ? s.text_preview : null;
    sourceKind = typeof s.source_kind === "string" ? s.source_kind : null;
    sourceInlineText = extractInlineSourceText(s);
  }
  if (typeof row.source_title === "string") sourceTitle = row.source_title;
  if (typeof row.source_url === "string") sourceUrl = row.source_url;
  if (typeof row.source_kind === "string") sourceKind = row.source_kind;

  return {
    id,
    text,
    sourceKey,
    sourceTitle,
    sourceUrl,
    sourceKind,
    textPreview,
    sourceInlineText,
  };
}

async function countSurrealLinkUnits(
  workspaceId: string,
  store: GraphStore,
  pack: ConnectDomainPack,
): Promise<number> {
  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
  try {
    const rows = await store.query<{ count?: number }[]>(
      `SELECT count() AS count FROM ${unitTable} GROUP ALL;`,
    );
    const counted = Number(rows[0]?.count ?? 0);
    if (counted > 0) return counted;
  } catch {
    // fall through to cached stats
  }
  const stats = await peekConnectGraphStats(workspaceId).catch(() => null);
  return stats?.units ?? 0;
}

function unitRowNeedsSourceLink(unit: LinkUnitRow): boolean {
  return unitNeedsSourceLink({
    sourceKind: unit.sourceKind,
    sourceTitle: unit.sourceTitle,
    sourceUrl: unit.sourceUrl,
    sourceKey: unit.sourceKey,
    resolvedQuality: inferSourceTextQualityForLink({
      textPreview: unit.textPreview,
      sourceTitle: unit.sourceTitle,
      sourceUrl: unit.sourceUrl,
      sourceInlineText: unit.sourceInlineText,
    }),
  });
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
    resolvedPreview: string | null;
  }[]
> {
  const sourceTable = tableIdent(pack.graph_schema.source_table, "source");
  const select = buildSourceSelectClause(pack);
  try {
    const rows = await store.query<Record<string, unknown>[]>(
      `SELECT ${select} FROM ${sourceTable} LIMIT 500;`,
    );
    const resolvedRows = await mapWithConcurrency(
      rows,
      SOURCE_CATALOG_RESOLVE_CONCURRENCY,
      async (row) => {
        const id =
          formatSurrealRecordId(row.id) ?? (typeof row.id === "string" ? row.id : null);
        if (!id) return null;
        const full = await resolveSurrealSourceFullText({
          store,
          pack,
          sourceRow: row,
          sourceId: id,
        });
        return {
          id,
          title: typeof row.title === "string" ? row.title : null,
          url: typeof row.url === "string" ? row.url : null,
          textPreview: typeof row.text_preview === "string" ? row.text_preview : null,
          sourceKind: typeof row.source_kind === "string" ? row.source_kind : null,
          fullText: full.quality === "full" ? full.text : null,
          resolvedPreview: full.quality === "preview" ? full.text : null,
        };
      },
    );
    return resolvedRows.filter((r): r is NonNullable<typeof r> => r != null);
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
      const text =
        resolved.text.trim() ||
        src.fullText?.trim() ||
        src.resolvedPreview?.trim() ||
        "";
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
    const graphSourceKey = graphSourceKeyFromProvenance(doc.provenance);
    const sourceKind =
      doc.sourceKind === "graph_import" ? "graph_import" : "document";
    const graphSourceId =
      args.target.provider === "postgres"
        ? await ensurePostgresGraphSourceId({
            workspaceId: args.workspaceId,
            domainPackId: args.job.domainPackId,
            jobId: args.job.id,
            title,
            url: doc.url,
            textPreview: preview,
            sourceKind,
          })
        : args.surrealStore && args.pack
          ? await ensureSurrealGraphSourceId({
              store: args.surrealStore,
              pack: args.pack,
              graphSourceKey,
              title,
              url: doc.url,
              textPreview: preview,
              sourceKind,
              registerSource: args.registerSource,
            })
          : await args.registerSource({
              title,
              url: doc.url,
              textPreview: preview,
              sourceKind,
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
          : args.surrealStore && args.pack
            ? await ensureSurrealGraphSourceId({
                store: args.surrealStore,
                pack: args.pack,
                title,
                url: src.url ?? null,
                textPreview: preview,
                sourceKind: src.url ? "url" : "text",
                registerSource: args.registerSource,
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

async function applySurrealUnitSourceUpdate(
  store: GraphStore,
  unitId: string,
  sourceId: string,
): Promise<void> {
  await store.query(
    `UPDATE ${surrealRecordRef(unitId)} MERGE { source: ${surrealRecordRef(sourceId)} };`,
  );
}

async function flushSurrealUnitSourceUpdates(
  store: GraphStore,
  pending: { unitId: string; sourceId: string }[],
): Promise<number> {
  if (pending.length === 0) return 0;
  let written = 0;
  for (let i = 0; i < pending.length; i += SURREAL_LINK_UPDATE_BATCH) {
    const chunk = pending.slice(i, i + SURREAL_LINK_UPDATE_BATCH);
    const sql = chunk
      .map(
        (row) =>
          `UPDATE ${surrealRecordRef(row.unitId)} MERGE { source: ${surrealRecordRef(row.sourceId)} };`,
      )
      .join("\n");
    try {
      await store.query(sql);
      written += chunk.length;
    } catch {
      for (const row of chunk) {
        try {
          await applySurrealUnitSourceUpdate(store, row.unitId, row.sourceId);
          written += 1;
        } catch (err) {
          console.warn(
            `[graph-source-link] failed to link ${row.unitId} → ${row.sourceId}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  }
  return written;
}

function unitNeedsLinkForJob(
  unit: LinkUnitRow,
  scope: GraphLinkSourcesJobMeta["scope"],
): boolean {
  if (scope === "all") return true;
  return unitNeedsSourceLink({
    sourceKind: unit.sourceKind,
    sourceTitle: unit.sourceTitle,
    sourceUrl: unit.sourceUrl,
    sourceKey: unit.sourceKey,
    resolvedQuality: inferSourceTextQualityForLink({
      textPreview: unit.textPreview,
      sourceTitle: unit.sourceTitle,
      sourceUrl: unit.sourceUrl,
      sourceInlineText: unit.sourceInlineText,
    }),
  });
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

  const pack = await resolveWorkspaceDomainPack(
    job.workspaceId,
    meta.domain_pack_id ?? job.domainPackId,
  );
  if (target.provider === "surreal" && !pack) {
    throw new IngestConfigError("domain_pack_not_configured");
  }
  const writer = await buildJobWriter(job);
  if (!writer) throw new IngestConfigError("graph_target_not_configured");

  const surrealStore =
    target.provider === "surreal" ? await buildWorkspaceGraphStore(job.workspaceId) : null;
  if (target.provider === "surreal" && !surrealStore) {
    throw new IngestConfigError("graph_store_unreachable");
  }

  for (const stage of SKIP_STAGES) {
    await reporter.skipStage(stage, "Skipped for automated source linking");
  }

  let cohortUnitIds: Set<string> | null = null;
  if (meta.cohort_run_id) {
    const { listReadinessRunUnitIds } = await import("$lib/server/neon");
    cohortUnitIds = new Set(await listReadinessRunUnitIds(meta.cohort_run_id));
    if (cohortUnitIds.size === 0) {
      // Empty cohort — nothing to link; skip the (expensive) catalog build and finish.
      await reporter.complete("Source linking complete — cohort is empty", "full");
      return { linked: 0, scanned: 0, candidates: 0 };
    }
  }

  await reporter.beginStage("storing", "Loading ideas and source catalog", 1);
  let units: LinkUnitRow[] = [];
  let surrealUnitsTotal = 0;
  if (target.provider === "surreal" && pack && surrealStore) {
    if (meta.scope === "unlinked_only") {
      const counted = await countSurrealUnitsNeedingSourceLink(job.workspaceId, pack).catch(
        () => ({ count: 0, estimate: false }),
      );
      surrealUnitsTotal = counted.count;
    } else {
      surrealUnitsTotal = await countSurrealLinkUnits(job.workspaceId, surrealStore, pack);
    }
    if (surrealUnitsTotal === 0) {
      await reporter.completeStage("storing", "No ideas found in graph store");
      await reporter.complete("Source linking complete — 0 ideas scanned", "full");
      return { linked: 0, scanned: 0, candidates: 0 };
    }
  } else {
    units = await loadPostgresLinkUnits(job.workspaceId);
    if (units.length === 0) {
      await reporter.completeStage("storing", "No ideas found in graph store");
      await reporter.complete("Source linking complete — 0 ideas scanned", "full");
      return { linked: 0, scanned: 0, candidates: 0 };
    }
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
    return { linked: 0, scanned: surrealUnitsTotal || units.length, candidates: 0 };
  }

  const preparedCandidates = prepareSourceMatchCandidates(candidates);
  const unitsTotal = surrealUnitsTotal > 0 ? surrealUnitsTotal : units.length;

  await reporter.beginStage(
    "storing",
    `Matching ${unitsTotal.toLocaleString()} idea(s) against ${candidates.length} source(s)`,
    Math.max(1, unitsTotal),
  );

  let linked = 0;
  let skipped = 0;
  let scanned = 0;
  let sinceLastTick = 0;
  const pendingSurrealUpdates: { unitId: string; sourceId: string }[] = [];
  const pendingPostgresUpdates: { unitId: string; sourceId: string }[] = [];

  const processUnit = (unit: LinkUnitRow) => {
    scanned += 1;
    sinceLastTick += 1;

    // Cohort runs only link units stamped to the run.
    if (cohortUnitIds && !cohortUnitIds.has(unit.id)) {
      skipped += 1;
      return;
    }

    if (!unitNeedsLinkForJob(unit, meta.scope)) {
      skipped += 1;
      return;
    }

    const match = pickBestPreparedSourceMatch(unit.text, preparedCandidates);
    if (!match) {
      skipped += 1;
      return;
    }

    if (unit.sourceKey && unit.sourceKey === match.candidate.graphSourceId) {
      skipped += 1;
      return;
    }

    if (target.provider === "surreal" && surrealStore) {
      pendingSurrealUpdates.push({
        unitId: unit.id,
        sourceId: match.candidate.graphSourceId,
      });
    } else {
      pendingPostgresUpdates.push({
        unitId: unit.id,
        sourceId: match.candidate.graphSourceId,
      });
    }
    linked += 1;
  };

  const flushProgressTick = async () => {
    if (sinceLastTick < LINK_PROGRESS_TICK_EVERY) return;
    const bump = sinceLastTick;
    sinceLastTick = 0;
    await reporter.tick(
      "storing",
      `Scanned ${scanned.toLocaleString()}/${unitsTotal.toLocaleString()} ideas`,
      bump,
    );
  };

  if (target.provider === "surreal" && surrealStore && pack) {
    const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
    const unlinkedOnly = meta.scope !== "all";
    await streamSurrealUnitRowsAll<Record<string, unknown>>(
      surrealStore,
      (limit, start) => surrealSourceLinkUnitsQuery(unitTable, limit, start, { unlinkedOnly }),
      async (page) => {
        for (const row of page) {
          const unit = mapSurrealRowToLinkUnit(row);
          if (!unit) {
            scanned += 1;
            sinceLastTick += 1;
            continue;
          }
          processUnit(unit);
        }
        await flushProgressTick();
      },
    );
  } else {
    for (const unit of units) {
      processUnit(unit);
      await flushProgressTick();
    }
    if (pendingPostgresUpdates.length > 0) {
      await reporter.tick(
        "storing",
        `Writing ${pendingPostgresUpdates.length.toLocaleString()} source link(s)`,
        0,
      );
      for (const row of pendingPostgresUpdates) {
        await updateUnitSourcePostgres({
          workspaceId: job.workspaceId,
          unitId: row.unitId,
          sourceId: row.sourceId,
        });
      }
    }
  }

  if (sinceLastTick > 0) {
    await reporter.tick(
      "storing",
      `Scanned ${scanned.toLocaleString()}/${unitsTotal.toLocaleString()} ideas`,
      sinceLastTick,
    );
    sinceLastTick = 0;
  }

  let surrealWritten = 0;
  if (target.provider === "surreal" && surrealStore && pendingSurrealUpdates.length > 0) {
    await reporter.tick(
      "storing",
      `Writing ${pendingSurrealUpdates.length.toLocaleString()} source link(s) to graph store`,
      0,
    );
    surrealWritten = await flushSurrealUnitSourceUpdates(surrealStore, pendingSurrealUpdates);
    pendingSurrealUpdates.length = 0;
    if (surrealWritten < linked) {
      await reporter.tick(
        "storing",
        `Persisted ${surrealWritten.toLocaleString()} of ${linked.toLocaleString()} matched link(s)`,
        0,
      );
    }
  }

  await reporter.completeStage(
    "storing",
    `Linked ${target.provider === "surreal" ? surrealWritten || linked : linked} idea(s); ${skipped} unchanged or unmatched`,
  );
  const linkedReported =
    target.provider === "surreal" && surrealWritten > 0 ? surrealWritten : linked;
  await reporter.complete(
    `Source linking complete — ${linkedReported} linked, ${scanned} scanned, ${candidates.length} sources in catalog`,
    "full",
  );
  return { linked: linkedReported, scanned, candidates: candidates.length };
}

/**
 * Resolve the next `limit` unit ids that still need readiness work — i.e. units
 * that are not yet validated (unchecked). Validation is the terminal step of the
 * journey, so "unchecked" is the meaningful backlog: a graph can be fully linked
 * (graph-native provenance) yet entirely unvalidated. Within a run, the link and
 * embed steps still handle any cohort members that also need linking/embedding.
 *
 * Used to define a readiness-run cohort up front: the resolved ids are stamped
 * into knowledge_readiness_run_units, then every step (link/embed/validate)
 * scopes to that set. Ids are canonicalized via formatSurrealRecordId so they
 * match the ids the three services filter against.
 */
export async function resolveNextCohortUnitIds(
  workspaceId: string,
  limit: number,
): Promise<string[]> {
  const cap = Math.min(Math.max(Math.floor(limit), 1), 100_000);
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (!target) return [];

  if (target.provider === "surreal") {
    const pack = await resolveWorkspaceDomainPack(workspaceId, null);
    const store = await buildWorkspaceGraphStore(workspaceId);
    if (!pack || !store) return [];
    const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
    const ids: string[] = [];
    await streamSurrealUnitRowsAll<Record<string, unknown>>(
      store,
      (l, start) => surrealRevalidateUnitsQuery(unitTable, l, start, false),
      async (page) => {
        for (const row of page) {
          const status = typeof row.validation_status === "string" ? row.validation_status : null;
          if (!isUncheckedValidationStatus(status)) continue;
          const id =
            formatSurrealRecordId(row.id) ?? (typeof row.id === "string" ? row.id : null);
          if (!id) continue;
          ids.push(id);
          if (ids.length >= cap) return true;
        }
      },
    );
    return ids.slice(0, cap);
  }

  const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT u.id
    FROM knowledge_graph_units u
    WHERE u.workspace_id = ${workspaceId}
      AND (u.validation_status IS NULL OR LOWER(u.validation_status) NOT IN ('ok', 'weak', 'unsupported'))
    ORDER BY u.created_at ASC, u.id ASC
    LIMIT ${cap}
  `) as { id: string }[];
  return rows.map((r) => r.id);
}

export async function countSurrealUnitsNeedingSourceLink(
  workspaceId: string,
  pack: ConnectDomainPack,
  opts?: { timeBudgetMs?: number },
): Promise<{ count: number; estimate: boolean }> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return { count: 0, estimate: false };

  const stats = await peekConnectGraphStats(workspaceId).catch(() => null);
  const { unitTable } = await resolveSurrealUnitTableForProvenance(store, pack, {
    totalUnitsHint: stats?.units,
  });
  if (!unitTable) return { count: 0, estimate: true };

  const aggregates = await loadSurrealProvenanceAggregateCounts(store, unitTable);
  if (aggregates.aggregatesOk) {
    return { count: aggregates.needsEdgeRepair, estimate: false };
  }

  const deadline =
    opts?.timeBudgetMs && opts.timeBudgetMs > 0 ? Date.now() + opts.timeBudgetMs : null;
  let needing = 0;
  let estimate = false;

  await streamSurrealUnitRowsAll<Record<string, unknown>>(
    store,
    (limit, start) => surrealRevalidateUnitsQuery(unitTable, limit, start, false),
    async (page) => {
      if (deadline && Date.now() > deadline) {
        estimate = true;
        return true;
      }
      for (const row of page) {
        const unit = mapSurrealRowToLinkUnit(row);
        if (!unit) continue;
        if (unitRowNeedsSourceLink(unit)) needing += 1;
      }
    },
  );

  if (estimate) {
    return { count: needing, estimate: true };
  }
  return { count: needing, estimate: false };
}

/** Lightweight stats for graph explorer Tools panel. */
export async function summarizeGraphSourceLinkNeed(workspaceId: string): Promise<{
  unitsNeedingLink: number;
  estimate?: boolean;
}> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (target?.provider === "surreal") {
    const pack = await resolveWorkspaceDomainPack(workspaceId);
    if (pack) {
      const counted = await countSurrealUnitsNeedingSourceLink(workspaceId, pack, {
        timeBudgetMs: LINK_OPTIONS_COUNT_BUDGET_MS,
      });
      return { unitsNeedingLink: counted.count, estimate: counted.estimate || undefined };
    }
  }
  return { unitsNeedingLink: await countGraphUnitsNeedingSourceLink(workspaceId) };
}
