/**
 * Re-validate existing graph units without re-extracting — updates validation_status
 * on units already stored in Postgres spine or Surreal BYO.
 * Optional validate_and_remediate mode runs remediation + re-embed for repaired units.
 */
import type { ConnectDomainPack, ConnectGraphRevalidateScope } from "@restormel/contracts/connect";
import { resolveQualityPreset, type ExtractionGenerate } from "@restormel/connect-core";
import {
  buildValidationBatchInputs,
  validateUnitsBatch,
  remapValidationBatchResults,
  finalizeValidationCoverage,
  type UnitValidation,
} from "@restormel/connect-core/ingest/validation";
import { formatSurrealRecordId } from "$lib/server/connect/graph-writer";
import { matchesGraphRevalidateScope } from "$lib/connect/validation-status";
import {
  streamSurrealUnitRowsAll,
  surrealRevalidateUnitsQuery,
} from "$lib/server/connect/surreal-graph-units-load";
import {
  buildRemediationStageGenerate,
  buildValidationStageGenerate,
  buildKnowledgeStageGenerates,
} from "$lib/server/connect/stage-route-generate";
import { buildJobWriter, IngestConfigError } from "$lib/server/connect/ingest-full-runner";
import type { ConnectIngestJobRecord } from "$lib/server/connect-ingest-jobs";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import type { GraphRevalidateJobMeta } from "$lib/server/connect/graph-revalidate-job";
import { runGraphRemediationPass } from "$lib/server/connect/graph-remediation-pass";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { resolveKnowledgeRouteExecutionContextForWorker } from "$lib/server/connect/stage-routing";
import { isConnectIngestLlmReady } from "$lib/server/connect/stage-route-generate";
import type { ConnectIngestProgressReporter } from "$lib/server/connect-ingest-progress";
import {
  fetchSurrealSourceRecordText,
  resolveConnectSourceText,
} from "$lib/server/connect/connect-source-text-resolve";
import {
  getConnectDomainPackById,
  getConnectGraphStats,
  getConnectGraphTargetForWorkspace,
  listConnectDomainPacksForWorkspace,
  type ConnectGraphTargetRecord,
} from "$lib/server/neon";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const POSTGRES_REVALIDATE_BATCH = 2000;

function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

type SurrealRevalidateRow = {
  id?: string | { toString(): string };
  text?: string;
  validation_status?: string | null;
  validation_note?: string | null;
  source?: unknown;
  source_title?: string | null;
  source_url?: string | null;
};

type RevalidateUnit = {
  id: string;
  text: string;
  validationStatus: string | null;
  validationNote: string | null;
};

type RevalidateSourceGroup = {
  sourceKey: string;
  title: string | null;
  url: string | null;
  textPreview: string | null;
  units: RevalidateUnit[];
};

function unitMatchesScope(unit: RevalidateUnit, scope: ConnectGraphRevalidateScope): boolean {
  return matchesGraphRevalidateScope(unit.validationStatus, unit.validationNote, scope);
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

function appendUnitToGroup(
  bySource: Map<string, RevalidateSourceGroup>,
  row: {
    id: string;
    text: string;
    validation_status: string | null;
    validation_note: string | null;
    source_id: string | null;
    source_title: string | null;
    source_url: string | null;
    source_preview: string | null;
  },
  scope: ConnectGraphRevalidateScope,
): void {
  const unit: RevalidateUnit = {
    id: row.id,
    text: row.text,
    validationStatus: row.validation_status,
    validationNote: row.validation_note,
  };
  if (!unitMatchesScope(unit, scope)) return;

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
  group.units.push(unit);
}

type RevalidateLoadResult = {
  groups: RevalidateSourceGroup[];
  /** True when a batch cap was hit and more matching units remain to process. */
  hadMore: boolean;
};

function countLoadedUnits(bySource: Map<string, RevalidateSourceGroup>): number {
  let n = 0;
  for (const g of bySource.values()) n += g.units.length;
  return n;
}

async function loadPostgresRevalidateGroups(
  workspaceId: string,
  scope: ConnectGraphRevalidateScope,
  maxUnits: number | null,
  cohortUnitIds: Set<string> | null,
): Promise<RevalidateLoadResult> {
  const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const bySource = new Map<string, RevalidateSourceGroup>();
  let lastId: string | null = null;
  let hadMore = false;

  const linkedOnly = scope === "linked";

  while (true) {
    const rows = (lastId
      ? (linkedOnly
        ? await sql`
            SELECT
              u.id,
              u.text,
              u.validation_status,
              u.validation_note,
              s.id AS source_id,
              s.title AS source_title,
              s.url AS source_url,
              s.text_preview AS source_preview
            FROM knowledge_graph_units u
            INNER JOIN knowledge_graph_sources s
              ON s.id = u.source_id AND s.workspace_id = u.workspace_id
            WHERE u.workspace_id = ${workspaceId}
              AND u.id > ${lastId}
            ORDER BY u.id ASC
            LIMIT ${POSTGRES_REVALIDATE_BATCH}
          `
        : await sql`
            SELECT
              u.id,
              u.text,
              u.validation_status,
              u.validation_note,
              s.id AS source_id,
              s.title AS source_title,
              s.url AS source_url,
              s.text_preview AS source_preview
            FROM knowledge_graph_units u
            LEFT JOIN knowledge_graph_sources s
              ON s.id = u.source_id AND s.workspace_id = u.workspace_id
            WHERE u.workspace_id = ${workspaceId}
              AND u.id > ${lastId}
            ORDER BY u.id ASC
            LIMIT ${POSTGRES_REVALIDATE_BATCH}
          `)
      : (linkedOnly
        ? await sql`
            SELECT
              u.id,
              u.text,
              u.validation_status,
              u.validation_note,
              s.id AS source_id,
              s.title AS source_title,
              s.url AS source_url,
              s.text_preview AS source_preview
            FROM knowledge_graph_units u
            INNER JOIN knowledge_graph_sources s
              ON s.id = u.source_id AND s.workspace_id = u.workspace_id
            WHERE u.workspace_id = ${workspaceId}
            ORDER BY u.id ASC
            LIMIT ${POSTGRES_REVALIDATE_BATCH}
          `
        : await sql`
            SELECT
              u.id,
              u.text,
              u.validation_status,
              u.validation_note,
              s.id AS source_id,
              s.title AS source_title,
              s.url AS source_url,
              s.text_preview AS source_preview
            FROM knowledge_graph_units u
            LEFT JOIN knowledge_graph_sources s
              ON s.id = u.source_id AND s.workspace_id = u.workspace_id
            WHERE u.workspace_id = ${workspaceId}
            ORDER BY u.id ASC
            LIMIT ${POSTGRES_REVALIDATE_BATCH}
          `)) as {
      id: string;
      text: string;
      validation_status: string | null;
      validation_note: string | null;
      source_id: string | null;
      source_title: string | null;
      source_url: string | null;
      source_preview: string | null;
    }[];

    if (!rows.length) break;
    for (const row of rows) {
      // Cohort runs scope to their stamped membership set (store-neutral filter).
      if (cohortUnitIds && !cohortUnitIds.has(row.id)) continue;
      appendUnitToGroup(bySource, row, scope);
      if (maxUnits != null && countLoadedUnits(bySource) >= maxUnits) {
        hadMore = true;
        break;
      }
    }
    if (hadMore) break;
    lastId = rows[rows.length - 1]!.id;
    if (rows.length < POSTGRES_REVALIDATE_BATCH) break;
  }

  return { groups: [...bySource.values()].filter((g) => g.units.length > 0), hadMore };
}

async function loadSurrealRevalidateGroups(
  workspaceId: string,
  pack: ConnectDomainPack,
  scope: ConnectGraphRevalidateScope,
  maxUnits: number | null,
  cohortUnitIds: Set<string> | null,
): Promise<RevalidateLoadResult> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return { groups: [], hadMore: false };

  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");

  // Stream pages and keep only scope-matching units grouped by source, so a large
  // graph is never materialised in full (only the matched subset + one page at a time).
  const bySource = new Map<string, RevalidateSourceGroup>();
  let total = 0;
  let hadMore = false;
  const linkedOnly = scope === "linked";

  await streamSurrealUnitRowsAll<SurrealRevalidateRow>(
    store,
    (limit, start, fetchSource) => surrealRevalidateUnitsQuery(unitTable, limit, start, fetchSource),
    (rows) => {
      for (const row of rows) {
        if (maxUnits != null && total >= maxUnits) {
          hadMore = true;
          return true;
        }
        if (typeof row.text !== "string" || !row.text.trim()) continue;

        // Skip units with no source edge when scope is "linked"
        if (linkedOnly && !row.source) continue;

        const unitId =
          formatSurrealRecordId(row.id) ?? (typeof row.id === "string" ? row.id : null);
        if (!unitId) continue;

        // Cohort runs scope to their stamped membership set.
        if (cohortUnitIds && !cohortUnitIds.has(unitId)) continue;

        const unit: RevalidateUnit = {
          id: unitId,
          text: row.text.trim(),
          validationStatus: row.validation_status ?? null,
          validationNote: row.validation_note ?? null,
        };
        if (!unitMatchesScope(unit, scope)) continue;

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
        let group = bySource.get(sourceKey);
        if (!group) {
          group = { sourceKey, title, url, textPreview, units: [] };
          bySource.set(sourceKey, group);
        }
        group.units.push(unit);
        total += 1;
      }
      return false;
    },
  );
  return { groups: [...bySource.values()].filter((g) => g.units.length > 0), hadMore };
}

async function loadRevalidateGroups(
  workspaceId: string,
  target: ConnectGraphTargetRecord,
  pack: ConnectDomainPack,
  scope: ConnectGraphRevalidateScope,
  maxUnits: number | null,
  cohortUnitIds: Set<string> | null,
): Promise<RevalidateLoadResult> {
  if (target.provider === "surreal") {
    return loadSurrealRevalidateGroups(workspaceId, pack, scope, maxUnits, cohortUnitIds);
  }
  return loadPostgresRevalidateGroups(workspaceId, scope, maxUnits, cohortUnitIds);
}

const SKIP_STAGES_VALIDATE_ONLY = ["extracting", "relating", "grouping", "embedding", "remediating"] as const;
const SKIP_STAGES_AUTO_REMEDIATE = ["extracting", "relating", "grouping", "embedding"] as const;
const GRAPH_REPAIR_HEARTBEAT_MS = 30_000;

function startGraphRepairHeartbeat(
  reporter: ConnectIngestProgressReporter,
  getMessage: () => string,
): () => void {
  const id = setInterval(() => {
    void reporter.log("VALIDATE", getMessage());
    void reporter.setGraphRepair({});
  }, GRAPH_REPAIR_HEARTBEAT_MS);
  return () => clearInterval(id);
}

async function validateUnitsWithProgress(args: {
  units: { ref: string; text: string }[];
  sourceText: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
  reporter: ConnectIngestProgressReporter;
  sourceIndex: number;
  sourcesTotal: number;
  sourceLabel: string;
  unitsDoneBefore: number;
  unitCount: number;
}): Promise<{ results: UnitValidation[]; unitsValidated: number }> {
  const preset = resolveQualityPreset(args.pack).preset;
  const batches = buildValidationBatchInputs(args.units);
  await args.reporter.setGraphRepair({
    phase: "validating",
    batches_total: batches.length,
    batches_done: 0,
  });
  await args.reporter.log(
    "VALIDATE",
    `Calling validation model — ${args.units.length} idea(s) in ${batches.length} batch(es) for ${args.sourceLabel} (may take several minutes)`,
  );

  const merged: UnitValidation[] = [];
  let unitsDoneInSource = 0;
  for (let bi = 0; bi < batches.length; bi++) {
    const { batchUnits, refToUnitId } = batches[bi]!;
    unitsDoneInSource += batchUnits.length;
    const unitsDone = args.unitsDoneBefore + unitsDoneInSource;
    await args.reporter.tick(
      "validating",
      `Source ${args.sourceIndex}/${args.sourcesTotal} · batch ${bi + 1}/${batches.length} · ${unitsDone}/${args.unitCount} ideas`,
      1,
      {
        phase: "validating",
        units_processed: unitsDone,
        batches_total: batches.length,
        batches_done: bi + 1,
        sources_done: args.sourceIndex,
      },
    );
    const parsed = await validateUnitsBatch({
      units: batchUnits,
      sourceText: args.sourceText,
      pack: args.pack,
      generate: args.generate,
      qualityPreset: preset,
    });
    merged.push(...remapValidationBatchResults(parsed, refToUnitId));
  }

  const results = finalizeValidationCoverage(args.units, merged);
  return { results, unitsValidated: args.units.length };
}

export async function runGraphRevalidation(args: {
  job: ConnectIngestJobRecord;
  meta: GraphRevalidateJobMeta;
  reporter: ConnectIngestProgressReporter;
}): Promise<{
  validated: number;
  units: number;
  sources: number;
  repaired: number;
  dropped: number;
  embedded: number;
  /** Verdicts written this run, tallied in-memory (source of truth for run quality). */
  validationCounts: { ok: number; weak: number; unsupported: number };
}> {
  const { job, meta, reporter } = args;
  const autoRemediate = meta.mode === "validate_and_remediate";
  const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
  if (!target) throw new IngestConfigError("graph_target_not_configured");

  const statsBefore = await getConnectGraphStats(job.workspaceId).catch(() => null);
  const quarantineBefore = statsBefore?.validation.awaiting_triage ?? null;

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

  const surrealStore =
    target.provider === "surreal" ? await buildWorkspaceGraphStore(job.workspaceId) : null;

  const skipStages = autoRemediate ? SKIP_STAGES_AUTO_REMEDIATE : SKIP_STAGES_VALIDATE_ONLY;
  for (const stage of skipStages) {
    await reporter.skipStage(stage, autoRemediate ? "Skipped for graph auto-remediation" : "Skipped for graph re-validation");
  }

  await reporter.log("VALIDATE", "Loading graph units for re-validation");
  const maxUnits = meta.max_units ?? null;
  if (maxUnits != null) {
    await reporter.log(
      "VALIDATE",
      `Batch run — processing up to ${maxUnits.toLocaleString()} ${meta.scope} unit(s) this run${meta.continue_in_background ? "; will auto-continue in the background until the backlog is clear" : ""}.`,
    );
  }
  let cohortUnitIds: Set<string> | null = null;
  if (meta.cohort_run_id) {
    const { listReadinessRunUnitIds } = await import("$lib/server/neon");
    cohortUnitIds = new Set(await listReadinessRunUnitIds(meta.cohort_run_id));
    await reporter.log(
      "VALIDATE",
      `Readiness run cohort — restricting to ${cohortUnitIds.size.toLocaleString()} stamped idea(s).`,
    );
  }
  // An empty cohort would otherwise scan the whole graph to find zero members —
  // short-circuit to a clean "nothing to do" completion instead.
  const { groups, hadMore } =
    cohortUnitIds && cohortUnitIds.size === 0
      ? { groups: [] as Awaited<ReturnType<typeof loadRevalidateGroups>>["groups"], hadMore: false }
      : await loadRevalidateGroups(job.workspaceId, target, pack, meta.scope, maxUnits, cohortUnitIds);
  const unitCount = groups.reduce((n, g) => n + g.units.length, 0);

  const scopedQuarantineBefore =
    meta.scope === "quarantine" || meta.scope === "unsupported"
      ? unitCount
      : quarantineBefore;

  reporter.initGraphRepair({
    mode: autoRemediate ? "validate_and_remediate" : "validate",
    units_total: unitCount,
    sources_total: Math.max(1, groups.length),
    ...(scopedQuarantineBefore != null ? { quarantine_before: scopedQuarantineBefore } : {}),
  });
  await reporter.setGraphRepair({ phase: "loading" });

  if (unitCount === 0) {
    await reporter.completeStage("validating", "No units matched the selected scope");
    await reporter.skipStage("storing", "Nothing to update");
    const label = autoRemediate ? "Auto-remediation complete — 0 units matched" : "Re-validation complete — 0 units matched";
    await reporter.complete(label, "full");
    return {
      validated: 0,
      units: 0,
      sources: 0,
      repaired: 0,
      dropped: 0,
      embedded: 0,
      validationCounts: { ok: 0, weak: 0, unsupported: 0 },
    };
  }

  const validationGenerate: ExtractionGenerate = buildValidationStageGenerate(
    routeCtx,
    meta.validation_route_id,
  );
  const remediationGenerate = autoRemediate
    ? buildRemediationStageGenerate(routeCtx, meta.remediation_route_id)
    : null;

  const stageKit = autoRemediate
    ? await buildKnowledgeStageGenerates({ workspaceId: job.workspaceId, routeCtx })
    : null;

  let validated = 0;
  const valCounts = { ok: 0, weak: 0, unsupported: 0 };
  let repaired = 0;
  let dropped = 0;
  let embedded = 0;
  let skippedUnits = 0;
  let previewOnlySources = 0;
  let sourcesRemediationFailed = 0;
  let unitsDone = 0;
  let sourceIndex = 0;
  const repairMode = autoRemediate ? "Re-validating" : "Re-validating";
  await reporter.beginStage(
    "validating",
    `${repairMode} ${unitCount} unit(s) across ${groups.length} source(s)`,
    unitCount,
  );
  await reporter.setGraphRepair({ phase: "validating" });

  const trustProvenance = meta.validation_mode === "trust_provenance";

  for (const group of groups) {
    sourceIndex += 1;
    const sourceLabel = group.title ?? group.sourceKey;
    await reporter.tick(
      "validating",
      `Source ${sourceIndex}/${groups.length} — ${sourceLabel}`,
      1,
      { sources_done: sourceIndex, phase: "validating" },
    );

    // Trust-provenance mode: no LLM, no source-text fetch. Ideas that are already
    // linked to a real source (graph-native provenance) are accepted as supported;
    // ideas with no source edge can't be trusted and are left unchecked.
    if (trustProvenance) {
      if (group.sourceKey === "__unknown__") {
        skippedUnits += group.units.length;
        unitsDone += group.units.length;
        const gr = reporter.getGraphRepair();
        await reporter.setGraphRepair({
          units_processed: unitsDone,
          sources_done: sourceIndex,
          skipped_no_source: (gr?.skipped_no_source ?? 0) + group.units.length,
        });
        continue;
      }
      validated += await writer.setValidation(
        group.units.map((u) => ({
          unitId: u.id,
          status: "ok" as const,
          note: "Accepted — graph-native provenance (trusted without AI check)",
        })),
      );
      valCounts.ok += group.units.length;
      unitsDone += group.units.length;
      await reporter.setGraphRepair({ units_processed: unitsDone, sources_done: sourceIndex });
      continue;
    }

    const surrealHints =
      surrealStore && pack
        ? await fetchSurrealSourceRecordText(surrealStore, group.sourceKey, pack)
        : null;

    const resolved = await resolveConnectSourceText({
      workspaceId: job.workspaceId,
      title: group.title ?? surrealHints?.title ?? null,
      url: group.url ?? surrealHints?.url ?? null,
      textPreview: group.textPreview ?? surrealHints?.textPreview ?? null,
      surrealFullText: surrealHints?.fullText ?? null,
    });

    if (!resolved.text.trim()) {
      skippedUnits += group.units.length;
      unitsDone += group.units.length;
      const gr = reporter.getGraphRepair();
      await reporter.setGraphRepair({
        units_processed: unitsDone,
        sources_done: sourceIndex,
        skipped_no_source: (gr?.skipped_no_source ?? 0) + group.units.length,
      });
      await reporter.log(
        "VALIDATE",
        `Skipped ${group.units.length} unit(s) — no source text for "${group.title ?? surrealHints?.title ?? group.sourceKey}". Use Graph tools → Graph source catalog to scan and import available source text, or add the source in Pipeline → Sources to fetch it.`,
      );
      continue;
    }
    if (resolved.quality === "preview") {
      previewOnlySources += 1;
      const gr = reporter.getGraphRepair();
      await reporter.setGraphRepair({
        preview_only_sources: (gr?.preview_only_sources ?? 0) + 1,
      });
      await reporter.log(
        "VALIDATE",
        `Using source preview only for "${sourceLabel}" — full document text was not found`,
      );
    }

    const textById = new Map(group.units.map((u) => [u.id, u.text]));
    const unitInputs = group.units.map((u) => ({ ref: u.id, text: u.text }));

    const stopHeartbeat = startGraphRepairHeartbeat(reporter, () => {
      const gr = reporter.getGraphRepair();
      const batchDone = gr?.batches_done ?? 0;
      const batchTotal = gr?.batches_total ?? "?";
      const processed = gr?.units_processed ?? unitsDone;
      return `Still working on source ${sourceIndex}/${groups.length} — batch ${batchDone}/${batchTotal} · ${processed}/${unitCount} ideas`;
    });

    let results: UnitValidation[];
    try {
      const outcome = await validateUnitsWithProgress({
        units: unitInputs,
        sourceText: resolved.text,
        pack,
        generate: validationGenerate,
        reporter,
        sourceIndex,
        sourcesTotal: groups.length,
        sourceLabel,
        unitsDoneBefore: unitsDone,
        unitCount,
      });
      results = outcome.results;
      unitsDone += outcome.unitsValidated;
    } finally {
      stopHeartbeat();
    }

    await reporter.setGraphRepair({
      units_processed: unitsDone,
      sources_done: sourceIndex,
    });

    validated += await writer.setValidation(
      results.map((r) => ({ unitId: r.ref, status: r.status, note: r.note ?? null })),
    );
    for (const r of results) {
      if (r.status === "ok") valCounts.ok += 1;
      else if (r.status === "weak") valCounts.weak += 1;
      else if (r.status === "unsupported") valCounts.unsupported += 1;
    }

    if (autoRemediate && remediationGenerate) {
      const pass = await runGraphRemediationPass({
        validationResults: results,
        textById,
        sourceText: resolved.text,
        pack,
        writer,
        validationGenerate,
        remediationGenerate,
        embed: stageKit?.embed,
        reporter,
        sourceLabel,
      });
      repaired += pass.repaired;
      dropped += pass.dropped;
      embedded += pass.embedded;
      await reporter.setGraphRepair({
        repaired,
        dropped,
        phase: "validating",
        sources_done: sourceIndex,
      });
      if (pass.remediationFailed) {
        sourcesRemediationFailed += 1;
        const gr = reporter.getGraphRepair();
        await reporter.setGraphRepair({
          sources_remediation_failed: (gr?.sources_remediation_failed ?? 0) + 1,
        });
      }
    }
  }

  await reporter.completeStage(
    "validating",
    `${validated}/${unitCount} validation row(s) persisted${skippedUnits > 0 ? ` (${skippedUnits} skipped — no source text)` : ""}`,
  );

  if (!autoRemediate) {
    await reporter.skipStage("remediating", "Validate-only mode");
  }

  await reporter.setGraphRepair({ phase: "storing" });
  await reporter.beginStage("storing", autoRemediate ? "Finalizing auto-remediation" : "Finalizing re-validation", 1);
  await reporter.completeStage("storing", "Validation statuses updated");

  const statsAfter = await getConnectGraphStats(job.workspaceId).catch(() => null);
  const quarantineAfter = statsAfter?.validation.awaiting_triage ?? null;
  await reporter.setGraphRepair({
    ...(quarantineAfter != null ? { quarantine_after: quarantineAfter } : {}),
    units_processed: unitCount,
    sources_done: groups.length,
  });

  const quarantineDelta =
    scopedQuarantineBefore != null && quarantineAfter != null
      ? ` Quarantine: ${scopedQuarantineBefore} → ${quarantineAfter}.`
      : "";

  const remediateSummary = autoRemediate
    ? ` ${repaired} repaired, ${dropped} dropped${embedded > 0 ? `, ${embedded} re-embedded` : ""}.`
    : "";

  const previewSummary =
    previewOnlySources > 0
      ? ` ${previewOnlySources} source(s) used preview-only text — link source documents for reliable remediation.`
      : "";

  const remediationFailSummary =
    sourcesRemediationFailed > 0
      ? ` ${sourcesRemediationFailed} source(s) failed remediation — check activity log for upstream model errors.`
      : "";

  const summary =
    skippedUnits > 0
      ? `${autoRemediate ? "Auto-remediation" : "Re-validation"} finished — ${validated}/${unitCount} unit(s) updated; ${skippedUnits} skipped (could not load source text).${remediateSummary}${previewSummary}${remediationFailSummary}${quarantineDelta} Refresh graph review to see new counts.`
      : `${autoRemediate ? "Auto-remediation" : "Re-validation"} complete — ${validated}/${unitCount} unit(s) updated.${remediateSummary}${previewSummary}${remediationFailSummary}${quarantineDelta} Refresh graph review to see new counts.`;

  // Auto-continue: this was a capped batch, more matching units remain, and we made
  // real progress — enqueue the next batch so a large backlog drains unattended.
  const madeProgress = validated > 0 || repaired > 0;
  if (meta.continue_in_background && hadMore && madeProgress) {
    try {
      const nextJobId = await enqueueGraphRevalidateJob({
        workspaceId: job.workspaceId,
        projectId: job.projectId,
        graphTargetId: target.id,
        meta,
      });
      await reporter.log(
        "VALIDATE",
        `More ${meta.scope} ideas remain — queued the next background batch (job ${nextJobId}).`,
      );
    } catch (err) {
      await reporter.log(
        "VALIDATE",
        `Could not queue the next background batch — run again to continue. ${err instanceof Error ? err.message : ""}`.trim(),
      );
    }
  } else if (validated === 0 && unitCount > 0) {
    await reporter.log(
      "VALIDATE",
      "No validation statuses were written. Check run logs above for skipped sources, Surreal credentials, and that Pipeline → Sources still has parsed documents for this graph.",
    );
  }

  await reporter.complete(summary, "full");

  return {
    validated,
    units: unitCount,
    sources: groups.length,
    repaired,
    dropped,
    embedded,
    validationCounts: valCounts,
  };
}

/**
 * Enqueue a graph re-validation job (shared by the API route and the background
 * auto-continue chain). Returns the new job id; best-effort triggers the worker.
 */
export async function enqueueGraphRevalidateJob(args: {
  workspaceId: string;
  projectId: string | null;
  graphTargetId: string | null;
  meta: GraphRevalidateJobMeta;
  label?: string;
}): Promise<string> {
  const { randomUUID } = await import("node:crypto");
  const { buildInitialConnectIngestJob } = await import("@restormel/connect-core");
  const { insertConnectIngestJob } = await import("$lib/server/connect-ingest-jobs");
  const { buildGraphRevalidateJobSources } = await import(
    "$lib/server/connect/graph-revalidate-job"
  );

  const jobId = randomUUID();
  const isAutoRemediate = args.meta.mode === "validate_and_remediate";
  const stopAfterStage = isAutoRemediate ? "remediating" : "validating";
  const dateLabel = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const label =
    args.label ??
    (isAutoRemediate ? `Graph auto-remediation — ${dateLabel}` : `Graph re-validation — ${dateLabel}`);

  const sources = buildGraphRevalidateJobSources(args.meta);
  const job = buildInitialConnectIngestJob({
    id: jobId,
    workspace_id: args.workspaceId,
    label,
    stop_after_stage: stopAfterStage,
  });
  await insertConnectIngestJob({
    id: jobId,
    workspaceId: args.workspaceId,
    projectId: args.projectId,
    label,
    stages: job.stages ?? [],
    sources,
    stopAfterStage,
    domainPackId: args.meta.domain_pack_id ?? null,
    graphTargetId: args.graphTargetId,
  });
  try {
    const { scheduleConnectIngestWorkerDrain } = await import("$lib/server/connect-ingest-worker");
    scheduleConnectIngestWorkerDrain();
  } catch {
    // Standalone worker will pick it up if in-process drain is unavailable.
  }
  return jobId;
}

/** Exported for unit tests. */
export { unitMatchesScope as matchesRevalidateUnitScope };
