/**
 * Re-validate existing graph units without re-extracting — updates validation_status
 * on units already stored in Postgres spine or Surreal BYO.
 */
import type { ConnectDomainPack, ConnectGraphRevalidateScope } from "@restormel/contracts/connect";
import { validateUnits, type ExtractionGenerate } from "@restormel/connect-core";
import { formatSurrealRecordId } from "$lib/server/connect/graph-writer";
import { buildValidationStageGenerate } from "$lib/server/connect/stage-route-generate";
import { buildJobWriter, IngestConfigError } from "$lib/server/connect/ingest-full-runner";
import type { ConnectIngestJobRecord } from "$lib/server/connect-ingest-jobs";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import type { GraphRevalidateJobMeta } from "$lib/server/connect/graph-revalidate-job";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { resolveKnowledgeRouteExecutionContextForWorker } from "$lib/server/connect/stage-routing";
import { isConnectIngestLlmReady } from "$lib/server/connect/stage-route-generate";
import type { ConnectIngestProgressReporter } from "$lib/server/connect-ingest-progress";
import {
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  listConnectDomainPacksForWorkspace,
  listConnectIngestJobsForWorkspace,
  type ConnectGraphTargetRecord,
} from "$lib/server/neon";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

type RevalidateUnit = { id: string; text: string; validationStatus: string | null };

type RevalidateSourceGroup = {
  sourceKey: string;
  title: string | null;
  url: string | null;
  textPreview: string | null;
  units: RevalidateUnit[];
};

function matchesScope(status: string | null, scope: ConnectGraphRevalidateScope): boolean {
  const s = status ?? "unvalidated";
  if (scope === "all") return true;
  if (scope === "unchecked") return s === "unvalidated" || !status;
  return s === "weak" || s === "unsupported";
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
    });
}

async function resolveDomainPack(
  workspaceId: string,
  packId: string | null | undefined,
): Promise<ConnectDomainPack | null> {
  let packRecord = packId
    ? await getConnectDomainPackById({ id: packId, workspaceId })
    : null;
  if (!packRecord) {
    const packs = await listConnectDomainPacksForWorkspace(workspaceId);
    packRecord = packs.find((p) => p.slug === "philosophy") ?? packs.find((p) => p.slug === "generic") ?? packs[0] ?? null;
  }
  if (!packRecord) return null;
  try {
    return domainPackRecordToApi(packRecord);
  } catch {
    return null;
  }
}

async function resolveSourceText(args: {
  workspaceId: string;
  title: string | null;
  url: string | null;
  textPreview: string | null;
}): Promise<{ text: string; quality: "full" | "preview" | "missing" }> {
  const jobs = await listConnectIngestJobsForWorkspace({ workspaceId: args.workspaceId, limit: 30 });
  for (const job of jobs) {
    for (const src of parseJobSources(job.sources)) {
      const titleMatch = args.title && src.title && src.title.trim() === args.title.trim();
      const urlMatch = args.url && src.url && src.url.trim() === args.url.trim();
      if ((titleMatch || urlMatch) && src.text?.trim()) {
        return { text: src.text.trim(), quality: "full" };
      }
    }
  }

  const { findConnectSourceDocumentText } = await import("$lib/server/neon");
  const docText = await findConnectSourceDocumentText({
    workspaceId: args.workspaceId,
    name: args.title,
    url: args.url,
  });
  if (docText?.trim()) return { text: docText.trim(), quality: "full" };

  if (args.textPreview?.trim()) {
    return { text: args.textPreview.trim(), quality: "preview" };
  }

  return { text: "", quality: "missing" };
}

async function loadPostgresRevalidateGroups(
  workspaceId: string,
  scope: ConnectGraphRevalidateScope,
): Promise<RevalidateSourceGroup[]> {
  const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      u.id,
      u.text,
      u.validation_status,
      s.id AS source_id,
      s.title AS source_title,
      s.url AS source_url,
      s.text_preview AS source_preview
    FROM knowledge_graph_units u
    LEFT JOIN knowledge_graph_sources s
      ON s.id = u.source_id AND s.workspace_id = u.workspace_id
    WHERE u.workspace_id = ${workspaceId}
    ORDER BY u.created_at ASC
    LIMIT 5000
  `) as {
    id: string;
    text: string;
    validation_status: string | null;
    source_id: string | null;
    source_title: string | null;
    source_url: string | null;
    source_preview: string | null;
  }[];

  const bySource = new Map<string, RevalidateSourceGroup>();
  for (const row of rows) {
    if (!matchesScope(row.validation_status, scope)) continue;
    const sourceKey = row.source_id ?? "__unknown__";
    let group = bySource.get(sourceKey);
    if (!group) {
      group = {
        sourceKey,
        title: row.source_title ?? null,
        url: row.source_url ?? null,
        textPreview: row.source_preview ?? null,
        units: [],
      };
      bySource.set(sourceKey, group);
    }
    group.units.push({
      id: row.id,
      text: row.text,
      validationStatus: row.validation_status ?? null,
    });
  }
  return [...bySource.values()].filter((g) => g.units.length > 0);
}

async function loadSurrealRevalidateGroups(
  workspaceId: string,
  pack: ConnectDomainPack,
  scope: ConnectGraphRevalidateScope,
): Promise<RevalidateSourceGroup[]> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return [];

  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
  const rows = await store.query<
    {
      id?: string | { toString(): string };
      text?: string;
      validation_status?: string | null;
      source?: unknown;
    }[]
  >(
    `SELECT id, text, validation_status, source.title AS source_title, source.url AS source_url, source.text_preview AS source_preview, source FROM ${unitTable} FETCH source LIMIT 5000;`,
  );

  const bySource = new Map<string, RevalidateSourceGroup>();
  for (const row of rows) {
    if (typeof row.text !== "string" || !row.text.trim()) continue;
    if (!matchesScope(row.validation_status ?? null, scope)) continue;

    const unitId =
      formatSurrealRecordId(row.id) ?? (typeof row.id === "string" ? row.id : null);
    if (!unitId) continue;

    let sourceKey = "__unknown__";
    let title: string | null = null;
    let url: string | null = null;
    let textPreview: string | null = null;

    const source = row.source;
    if (typeof source === "string" && source.includes(":")) {
      sourceKey = source;
    } else if (source && typeof source === "object" && !Array.isArray(source)) {
      const s = source as Record<string, unknown>;
      sourceKey =
        formatSurrealRecordId(s.id) ?? (typeof s.id === "string" ? s.id : sourceKey);
      title = typeof s.title === "string" ? s.title : null;
      url = typeof s.url === "string" ? s.url : null;
      textPreview = typeof s.text_preview === "string" ? s.text_preview : null;
    }
    if (typeof (row as Record<string, unknown>).source_title === "string") {
      title = String((row as Record<string, unknown>).source_title);
    }
    if (typeof (row as Record<string, unknown>).source_url === "string") {
      url = String((row as Record<string, unknown>).source_url);
    }
    if (typeof (row as Record<string, unknown>).source_preview === "string") {
      textPreview = String((row as Record<string, unknown>).source_preview);
    }

    let group = bySource.get(sourceKey);
    if (!group) {
      group = { sourceKey, title, url, textPreview, units: [] };
      bySource.set(sourceKey, group);
    }
    group.units.push({
      id: unitId,
      text: row.text.trim(),
      validationStatus: row.validation_status ?? null,
    });
  }
  return [...bySource.values()].filter((g) => g.units.length > 0);
}

async function loadRevalidateGroups(
  workspaceId: string,
  target: ConnectGraphTargetRecord,
  pack: ConnectDomainPack,
  scope: ConnectGraphRevalidateScope,
): Promise<RevalidateSourceGroup[]> {
  if (target.provider === "surreal") {
    return loadSurrealRevalidateGroups(workspaceId, pack, scope);
  }
  if (target.provider === "postgres" && target.useDashboardDatabase) {
    return loadPostgresRevalidateGroups(workspaceId, scope);
  }
  return loadPostgresRevalidateGroups(workspaceId, scope);
}

const SKIP_STAGES = ["extracting", "relating", "grouping", "embedding", "remediating"] as const;

export async function runGraphRevalidation(args: {
  job: ConnectIngestJobRecord;
  meta: GraphRevalidateJobMeta;
  reporter: ConnectIngestProgressReporter;
}): Promise<{ validated: number; units: number; sources: number }> {
  const { job, meta, reporter } = args;
  const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
  if (!target) throw new IngestConfigError("graph_target_not_configured");

  const routeCtx = await resolveKnowledgeRouteExecutionContextForWorker({
    workspaceId: job.workspaceId,
    projectId: job.projectId,
  });
  if (!routeCtx) throw new IngestConfigError("routing_not_configured");

  const llmReady = await isConnectIngestLlmReady({
    workspaceId: job.workspaceId,
    routeCtx,
  });
  if (!llmReady) throw new IngestConfigError("llm_not_configured");

  const pack = await resolveDomainPack(
    job.workspaceId,
    meta.domain_pack_id ?? job.domainPackId,
  );
  if (!pack) throw new IngestConfigError("domain_pack_not_found");

  const writer = await buildJobWriter(job);
  if (!writer) throw new IngestConfigError("graph_target_not_configured");

  for (const stage of SKIP_STAGES) {
    await reporter.skipStage(stage, "Skipped for graph re-validation");
  }

  await reporter.beginStage("validating", "Loading graph units for re-validation", 1);
  const groups = await loadRevalidateGroups(job.workspaceId, target, pack, meta.scope);
  const unitCount = groups.reduce((n, g) => n + g.units.length, 0);
  if (unitCount === 0) {
    await reporter.completeStage("validating", "No units matched the selected scope");
    await reporter.skipStage("storing", "Nothing to update");
    await reporter.complete("Re-validation complete — 0 units matched", "full");
    return { validated: 0, units: 0, sources: 0 };
  }

  const validationGenerate: ExtractionGenerate = buildValidationStageGenerate(
    routeCtx,
    meta.validation_route_id,
  );

  let validated = 0;
  let sourceIndex = 0;
  await reporter.beginStage(
    "validating",
    `Re-validating ${unitCount} unit(s) across ${groups.length} source(s)`,
    Math.max(1, groups.length),
  );

  for (const group of groups) {
    sourceIndex += 1;
    await reporter.tick(
      "validating",
      `Source ${sourceIndex}/${groups.length} — ${group.title ?? group.sourceKey}`,
    );

    const resolved = await resolveSourceText({
      workspaceId: job.workspaceId,
      title: group.title,
      url: group.url,
      textPreview: group.textPreview,
    });

    if (!resolved.text.trim()) {
      await reporter.log(
        "VALIDATE",
        `Skipped ${group.units.length} unit(s) — could not resolve source text for "${group.title ?? group.sourceKey}"`,
      );
      continue;
    }
    if (resolved.quality === "preview") {
      await reporter.log(
        "VALIDATE",
        `Using source preview only for "${group.title ?? group.sourceKey}" — full document text was not found`,
      );
    }

    const results = await validateUnits({
      units: group.units.map((u) => ({ ref: u.id, text: u.text })),
      sourceText: resolved.text,
      pack,
      generate: validationGenerate,
    });
    validated += await writer.setValidation(
      results.map((r) => ({ unitId: r.ref, status: r.status, note: r.note ?? null })),
    );
  }

  await reporter.completeStage(
    "validating",
    `${validated}/${unitCount} validation row(s) persisted`,
  );
  await reporter.beginStage("storing", "Finalizing re-validation", 1);
  await reporter.completeStage("storing", "Validation statuses updated");
  await reporter.complete(
    `Re-validation complete — ${validated}/${unitCount} unit(s) updated`,
    "full",
  );

  return { validated, units: unitCount, sources: groups.length };
}
