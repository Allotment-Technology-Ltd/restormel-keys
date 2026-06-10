/**
 * Full-mode ingest runner (domain-agnostic, storage-agnostic).
 *
 * Runs the pipeline — extract → relate → group → embed → validate → remediate —
 * against a GraphWriter, so Postgres spine and Bring-Your-Own SurrealDB get the
 * same stages. All vocabulary/schema comes from the domain pack, not hardcoded.
 */
import type { ConnectDomainPack, ConnectSourceProvenance } from "@restormel/contracts/connect";
import { provenancePreviewText } from "$lib/server/connect/source-document-provenance";
import {
  chunkDocument,
  contentHash,
  entailmentToLegacyStatus,
  extractGraph,
  evaluateExtractionGate,
  groupUnits,
  judgeEntailment,
  shouldRunStage,
  resolveQualityPreset,
  readEntailmentKForPreset,
  readMaxChunksForPreset,
  effectiveStopAfterStage,
  ENTAILMENT_BATCH_SIZE,
  type EntailmentInput,
  type EvidenceBinding,
  type ExtractionGenerate,
  type EmbeddingPort,
  type GraphIngestContext,
  type UnitEntailment,
} from "@restormel/connect-core";
import {
  buildEvidenceRows,
  buildLayer2StateRows,
  buildVerificationStateRows,
  type EvidenceRow,
} from "$lib/server/connect/evidence-persist";
import {
  buildValidationBatchInputs,
  validateUnitsBatch,
  remapValidationBatchResults,
  finalizeValidationCoverage,
  type UnitValidation,
} from "@restormel/connect-core/ingest/validation";
import { loadGraphIngestContext } from "$lib/server/connect/graph-ingest-context";
import {
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  insertConnectGraphSourcePostgres,
  listConnectDomainPacksForWorkspace,
  type ConnectIngestJobRecord,
} from "$lib/server/neon";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { requireGraphUnitSourceId } from "$lib/server/connect/graph-ingest-source";
import { buildGraphWriter, type GraphWriter } from "$lib/server/connect/graph-writer";
import { runGraphRemediationPass } from "$lib/server/connect/graph-remediation-pass";
import { isModuleEnabled, resolveModuleFlagsSync } from "$lib/server/module-flags";
import type { ConnectIngestProgressReporter } from "$lib/server/connect-ingest-progress";

export class IngestConfigError extends Error {}

/**
 * EBV Layer 2 (Stage 1.0d) span-scoped entailment is the DEFAULT validation path.
 * The legacy prefix-batch validator stays available for ONE release for comparison
 * runs via CONNECT_LEGACY_VALIDATION=1. Removal condition: delete the legacy branch
 * once the 1.0a′ post-EBV benchmark snapshot is committed and its bars signed off.
 */
function useLegacyValidation(): boolean {
  return process.env.CONNECT_LEGACY_VALIDATION === "1";
}

const SAFE_TABLE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const FULL_STAGE_HEARTBEAT_MS = 20_000;

/** Re-persist progress every ~20s so a slow LLM stage keeps the operator UI alive. */
function startStageHeartbeat(
  reporter: ConnectIngestProgressReporter | undefined,
  getMessage: () => string,
): () => void {
  if (!reporter) return () => {};
  const id = setInterval(() => {
    void reporter.heartbeat(getMessage());
  }, FULL_STAGE_HEARTBEAT_MS);
  return () => clearInterval(id);
}

type IngestSource = {
  url?: string;
  text?: string;
  title?: string;
  provenance?: ConnectSourceProvenance;
};

function parseSources(raw: unknown): IngestSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const rec = r as Record<string, unknown>;
      const prov =
        rec.provenance && typeof rec.provenance === "object" && !Array.isArray(rec.provenance)
          ? (rec.provenance as ConnectSourceProvenance)
          : undefined;
      return {
        ...(typeof rec.url === "string" ? { url: rec.url } : {}),
        ...(typeof rec.text === "string" ? { text: rec.text } : {}),
        ...(typeof rec.title === "string" ? { title: rec.title } : {}),
        ...(prov ? { provenance: prov } : {}),
      };
    });
}

function sourceTextPreview(src: IngestSource): string | null {
  const fromProv = provenancePreviewText(src.provenance);
  if (fromProv) return fromProv;
  return src.text?.trim() ? src.text.trim().slice(0, 500) : null;
}

async function resolveDomainPack(job: ConnectIngestJobRecord): Promise<ConnectDomainPack | null> {
  let packRecord = job.domainPackId
    ? await getConnectDomainPackById({ id: job.domainPackId, workspaceId: job.workspaceId })
    : null;
  if (!packRecord) {
    const packs = await listConnectDomainPacksForWorkspace(job.workspaceId);
    packRecord = packs.find((p) => p.slug === "generic") ?? packs[0] ?? null;
  }
  if (!packRecord) return null;
  try {
    return domainPackRecordToApi(packRecord);
  } catch {
    return null;
  }
}

async function resolveSourceTable(job: ConnectIngestJobRecord): Promise<string> {
  const pack = await resolveDomainPack(job);
  const table = pack?.graph_schema.source_table ?? "source";
  return SAFE_TABLE.test(table) ? table : "source";
}

/** Build a writer for the job's configured target, or null when unavailable. */
export async function buildJobWriter(job: ConnectIngestJobRecord): Promise<GraphWriter | null> {
  const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
  if (!target) throw new IngestConfigError("graph_target_not_configured");
  if (target.provider === "postgres") {
    const flags = resolveModuleFlagsSync();
    if (!isModuleEnabled(flags, "connectNeonGraphStore")) {
      throw new IngestConfigError("connect_neon_graph_store_disabled");
    }
  }
  const pack = await resolveDomainPack(job);
  if (!pack) throw new IngestConfigError("domain_pack_not_found");
  return buildGraphWriter(target, pack, {
    workspaceId: job.workspaceId,
    domainPackId: job.domainPackId,
    id: job.id,
  });
}

/**
 * Run the full pipeline against a GraphWriter (Postgres spine or Surreal):
 * extract → relate → group → embed → validate → remediate (self-healing).
 * The same enforced, pack-driven prompts drive every stage. Honors
 * stop_after_stage and is bounded by CONNECT_INGEST_MAX_CHUNKS.
 */
export interface StageGenerates {
  extraction: ExtractionGenerate;
  grouping: ExtractionGenerate;
  validation: ExtractionGenerate;
  remediation: ExtractionGenerate;
}

export async function runFullExtraction(args: {
  job: ConnectIngestJobRecord;
  writer: GraphWriter;
  generates: StageGenerates;
  embed?: EmbeddingPort;
  reporter?: ConnectIngestProgressReporter;
  /** Resolved validation-route model id, recorded with every entailment verdict. */
  validationModelId?: string | null;
}): Promise<{
  sources: number;
  units: number;
  relations: number;
  chunks: number;
  groups: number;
  embedded: number;
  validated: number;
  repaired: number;
  dropped: number;
  /** Store-neutral verdict tally (pre-remediation) for the run quality report. */
  validation: { ok: number; weak: number; unsupported: number };
}> {
  const { job, writer, reporter } = args;
  const pack = await resolveDomainPack(job);
  if (!pack) throw new IngestConfigError("domain_pack_not_found");

  const quality = resolveQualityPreset(pack);
  const graphContext: GraphIngestContext = await loadGraphIngestContext(job.workspaceId);
  const preset = quality.preset;
  const stop = effectiveStopAfterStage(
    job.stopAfterStage as
      | "extracting"
      | "relating"
      | "grouping"
      | "embedding"
      | "validating"
      | "remediating"
      | "storing"
      | null,
    quality,
  );
  const maxChunks = readMaxChunksForPreset(quality, process.env.CONNECT_INGEST_MAX_CHUNKS);
  /** Grouping is LLM-heavy; validation runs on all extracted units in batches. */
  const GROUPING_UNIT_CAP = 80;
  const sources = parseSources(job.sources);

  let chunkBudget = maxChunks;
  let totalUnits = 0;
  let totalRelations = 0;
  let chunksProcessed = 0;
  let totalGroups = 0;
  let totalValidated = 0;
  let totalRepaired = 0;
  let totalDropped = 0;
  // Store-neutral verdict tally — the authoritative source for the run's supported %
  // (a Surreal BYO store isn't visible to the Postgres-spine stats query).
  const validationBreakdown = { ok: 0, weak: 0, unsupported: 0 };
  // Final unit text for embedding (mutated by remediation), keyed by id.
  const embedText = new Map<string, string>();

  for (const src of sources) {
    const title = src.title ?? src.url ?? "untitled";
    await reporter?.setAction(`Registering source — ${title}`);
    const sourceId = requireGraphUnitSourceId(
      await writer.writeSource({
        title,
        url: src.url ?? null,
        textPreview: sourceTextPreview(src),
        sourceKind: src.url ? "url" : "text",
      }),
    );
    await reporter?.log("INGEST", `Source registered — ${title}`);

    if (!src.text?.trim() || chunkBudget <= 0) continue;

    // EBV Layer 1: pin this source version once; all evidence spans bind against it.
    const sourceHash = await contentHash(src.text);
    const evidenceRows: EvidenceRow[] = [];
    const bindingByUnitId = new Map<string, EvidenceBinding>();
    const evidenceCounts = { bound: 0, unbound: 0, no_evidence: 0 };

    const sourceUnits: { id: string; text: string; type: string | null; chunkIndex: number }[] = [];
    const chunkTextByUnitId = new Map<string, string>();
    const chunks = chunkDocument(src.text, pack.chunking).slice(0, chunkBudget);
    await reporter?.beginStage(
      "extracting",
      `Extracting graph from ${title}`,
      Math.max(1, chunks.length),
    );
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      if (chunkBudget <= 0) break;
      chunkBudget -= 1;
      chunksProcessed += 1;
      await reporter?.tick(
        "extracting",
        `Chunk ${i + 1}/${chunks.length} — LLM extract + relate`,
      );
      const extraction = await extractGraph({
        text: chunk.text,
        pack,
        generate: args.generates.extraction,
        qualityPreset: preset,
        graphContext,
      });
      if (extraction.warnings.length > 0) {
        const summary = extraction.warnings
          .map((w) => `${w.code}${w.count != null ? `(${w.count})` : ""}`)
          .join(", ");
        await reporter?.log("EXTRACT", `Chunk ${i + 1} warnings — ${summary}`);
      }
      const gate = evaluateExtractionGate(
        extraction.warnings,
        preset,
        pack.ontology.schema_mode,
      );
      if (!gate.allowPersist) {
        await reporter?.log(
          "EXTRACT",
          `Chunk ${i + 1} skipped — production gate (${gate.reason ?? "blocked"})`,
        );
        continue;
      }
      const stored = await writer.writeUnitsAndRelations({
        sourceId,
        units: extraction.units.map((u) => ({
          localId: u.id,
          text: u.text,
          unitType: u.type ?? null,
          domain: u.domain ?? null,
          sourceChunkIndex: i,
        })),
        relations: extraction.relations.map((r) => ({
          fromLocalId: r.from,
          toLocalId: r.to,
          relationType: r.relation,
        })),
      });
      totalUnits += stored.units.length;
      totalRelations += stored.relations;
      if (extraction.relations.length > stored.relations) {
        await reporter?.log(
          "RELATE",
          `${stored.relations}/${extraction.relations.length} edges persisted — check relation ids or Surreal permissions`,
        );
      }
      for (const u of stored.units) {
        sourceUnits.push({ id: u.id, text: u.text, type: u.type, chunkIndex: i });
        chunkTextByUnitId.set(u.id, chunk.text);
        embedText.set(u.id, u.text);
      }
      const chunkEvidence = buildEvidenceRows({
        extractedUnits: extraction.units,
        storedUnits: stored.units,
        sourceText: src.text,
        sourceHash,
      });
      evidenceRows.push(...chunkEvidence.rows);
      for (const [id, b] of chunkEvidence.bindingByUnitId) bindingByUnitId.set(id, b);
      evidenceCounts.bound += chunkEvidence.counts.bound;
      evidenceCounts.unbound += chunkEvidence.counts.unbound;
      evidenceCounts.no_evidence += chunkEvidence.counts.no_evidence;
    }
    await reporter?.completeStage(
      "extracting",
      `${totalUnits} units, ${totalRelations} relations from ${title}`,
    );
    await reporter?.beginStage("relating", "Relations persisted with extraction", 1);
    await reporter?.completeStage("relating", "Relation pass complete");

    if (sourceUnits.length === 0) continue;

    if (evidenceRows.length > 0) {
      const ev = await writer.setEvidence({ sourceHash, bindings: evidenceRows });
      await reporter?.log(
        "EXTRACT",
        `Evidence: ${evidenceCounts.bound}/${evidenceRows.length} bound` +
          (evidenceCounts.unbound ? `, ${evidenceCounts.unbound} unbound` : "") +
          (evidenceCounts.no_evidence ? `, ${evidenceCounts.no_evidence} without a quote` : "") +
          (ev.missed > 0 ? ` — ${ev.missed} write(s) not persisted (store schema; see EBV docs)` : ""),
      );
    }
    const cappedForGrouping = sourceUnits.slice(0, GROUPING_UNIT_CAP);
    const textById = new Map(sourceUnits.map((u) => [u.id, u.text]));

    if (shouldRunStage("grouping", stop)) {
      await reporter?.beginStage("grouping", `Grouping ${cappedForGrouping.length} units`, 1);
      try {
        const groups = await groupUnits({
          units: cappedForGrouping.map((u) => ({ ref: u.id, text: u.text, ...(u.type ? { type: u.type } : {}) })),
          pack,
          generate: args.generates.grouping,
          qualityPreset: preset,
        });
        const res = await writer.storeGroups(
          groups.map((g) => ({
            name: g.name,
            summary: g.summary ?? null,
            members: g.members.map((m) => ({ unitId: m.ref, role: m.role ?? null })),
          })),
        );
        totalGroups += res.groups;
        await reporter?.completeStage("grouping", `${res.groups} group(s) stored`);
      } catch {
        await reporter?.skipStage("grouping", "Grouping failed — continuing");
      }
    } else {
      await reporter?.skipStage("grouping", "Stop-after gate");
    }

    if (shouldRunStage("validating", stop)) {
      const unitInputs = sourceUnits.map((u) => ({ ref: u.id, text: u.text }));
      // Pace the stage by unit count and tick per batch so percent/ETA actually
      // move and the activity log streams — the old single-call stage looked frozen
      // for minutes while hundreds of units were checked.
      await reporter?.beginStage(
        "validating",
        `Validating ${unitInputs.length} unit(s) from ${title}`,
        Math.max(1, unitInputs.length),
      );
      let validationResults: UnitValidation[] | null = null;
      // EBV Layer 2: abstained claims route to the review queue, never remediation.
      let abstainedIds = new Set<string>();
      try {
        if (useLegacyValidation()) {
          const batches = buildValidationBatchInputs(unitInputs);
          await reporter?.log(
            "VALIDATE",
            `LEGACY validator (CONNECT_LEGACY_VALIDATION=1): checking ${unitInputs.length} idea(s) in ${batches.length} batch(es)`,
          );
          const merged: UnitValidation[] = [];
          let validateDone = 0;
          const stopHeartbeat = startStageHeartbeat(
            reporter,
            () =>
              `Still validating ${title} — ${validateDone}/${unitInputs.length} idea(s) checked`,
          );
          try {
            for (let bi = 0; bi < batches.length; bi++) {
              const { batchUnits, refToUnitId } = batches[bi]!;
              const parsed = await validateUnitsBatch({
                units: batchUnits,
                sourceText: src.text,
                pack,
                generate: args.generates.validation,
                qualityPreset: preset,
                graphContext,
              });
              merged.push(...remapValidationBatchResults(parsed, refToUnitId));
              validateDone += batchUnits.length;
              await reporter?.tick(
                "validating",
                `Validated batch ${bi + 1}/${batches.length} · ${validateDone}/${unitInputs.length} idea(s)`,
                batchUnits.length,
              );
            }
          } finally {
            stopHeartbeat();
          }
          validationResults = finalizeValidationCoverage(unitInputs, merged);
          // EBV: compose verdicts with Layer-1 bindings — never "supported" without a span.
          const stateRows = buildVerificationStateRows({
            verdicts: validationResults.map((r) => ({ unitId: r.ref, status: r.status })),
            bindingByUnitId,
          });
          const st = await writer.setVerificationStates(stateRows.states);
          await reporter?.log(
            "VALIDATE",
            `Verification states: ${stateRows.counts.supported} supported, ${stateRows.counts.inferred} inferred, ` +
              `${stateRows.counts.unverified} unverified` +
              (st.missed > 0 ? ` — ${st.missed} write(s) not persisted (store schema)` : ""),
          );
        } else {
          // EBV Layer 2 (Stage 1.0d): per claim, judge ONLY "does its bound span entail
          // it" — no source prefix. Unbound claims abstain locally (review) at no cost.
          const inputs: EntailmentInput[] = sourceUnits.map((u) => {
            const b = bindingByUnitId.get(u.id);
            return {
              ref: u.id,
              claim: u.text,
              spans: b?.status === "bound" ? [b.span.quote] : [],
            };
          });
          const kSamples = readEntailmentKForPreset(quality);
          await reporter?.log(
            "VALIDATE",
            `Span-scoped entailment: judging ${inputs.length} claim(s) against their bound evidence` +
              (kSamples > 1 ? ` (k=${kSamples} self-consistency)` : ""),
          );
          const judged: UnitEntailment[] = [];
          let judgeMeta: Awaited<ReturnType<typeof judgeEntailment>>["meta"] | null = null;
          let entailDone = 0;
          const stopHeartbeat = startStageHeartbeat(
            reporter,
            () => `Still validating ${title} — ${entailDone}/${inputs.length} claim(s) judged`,
          );
          try {
            for (let off = 0; off < inputs.length; off += ENTAILMENT_BATCH_SIZE) {
              const slice = inputs.slice(off, off + ENTAILMENT_BATCH_SIZE);
              const res = await judgeEntailment({
                inputs: slice,
                generate: args.generates.validation,
                kSamples,
                modelId: args.validationModelId ?? null,
              });
              judged.push(...res.results);
              judgeMeta = judgeMeta ?? res.meta;
              entailDone += slice.length;
              await reporter?.tick(
                "validating",
                `Judged ${entailDone}/${inputs.length} claim(s)`,
                slice.length,
              );
            }
          } finally {
            stopHeartbeat();
          }
          validationResults = judged.map((r) => ({
            ref: r.ref,
            status: entailmentToLegacyStatus(r),
            ...(r.note ? { note: r.note } : {}),
          }));
          if (judgeMeta) {
            const l2 = buildLayer2StateRows({ results: judged, bindingByUnitId, meta: judgeMeta });
            abstainedIds = new Set(l2.abstained);
            const st = await writer.setVerificationStates(l2.states);
            const audit = await writer.recordJudgments(l2.judgments);
            await reporter?.log(
              "VALIDATE",
              `Verification states: ${l2.counts.supported} supported, ${l2.counts.inferred} inferred, ` +
                `${l2.counts.unverified} unverified` +
                (abstainedIds.size > 0 ? ` (${abstainedIds.size} abstained → review)` : "") +
                (st.missed > 0 ? ` — ${st.missed} state write(s) not persisted` : "") +
                (audit.missed > 0 ? ` — ${audit.missed} judgment write(s) not persisted` : ""),
            );
          }
        }
        for (const r of validationResults) {
          if (r.status === "ok") validationBreakdown.ok += 1;
          else if (r.status === "weak") validationBreakdown.weak += 1;
          else if (r.status === "unsupported") validationBreakdown.unsupported += 1;
        }
        totalValidated += await writer.setValidation(
          validationResults.map((r) => ({ unitId: r.ref, status: r.status, note: r.note ?? null })),
        );
        await reporter?.completeStage(
          "validating",
          `${totalValidated}/${sourceUnits.length} validation row(s) persisted`,
        );
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Validation failed";
        await reporter?.skipStage("validating", `${detail.slice(0, 140)} — continuing`);
        validationResults = null;
      }

      if (validationResults && shouldRunStage("remediating", stop)) {
        // Abstentions are review-queue items (unverified), NOT remediation inputs —
        // remediating an abstained claim would launder uncertainty into repair/drop.
        const remediable = validationResults.filter((r) => !abstainedIds.has(r.ref));
        const pass = await runGraphRemediationPass({
          validationResults: remediable,
          textById,
          sourceText: src.text,
          pack,
          writer,
          validationGenerate: args.generates.validation,
          remediationGenerate: args.generates.remediation,
          reporter,
          ebv: useLegacyValidation()
            ? undefined
            : {
                bindingByUnitId,
                kSamples: readEntailmentKForPreset(quality),
                modelId: args.validationModelId ?? null,
              },
        });
        for (const id of pass.repairedUnitIds) {
          const text = textById.get(id);
          if (text) embedText.set(id, text);
          chunkTextByUnitId.delete(id);
        }
        totalRepaired += pass.repaired;
        totalDropped += pass.dropped;
      } else if (!validationResults) {
        await reporter?.skipStage("remediating", "Validation did not complete");
      } else {
        await reporter?.skipStage("remediating", "Stop-after gate");
      }
    } else {
      await reporter?.skipStage("validating", "Stop-after gate");
      await reporter?.skipStage("remediating", "Stop-after gate");
    }
  }

  let embedded = 0;
  if (args.embed && embedText.size > 0 && shouldRunStage("embedding", stop)) {
    const entries = [...embedText.entries()];
    await reporter?.beginStage("embedding", `Embedding ${entries.length} unit(s)`, 1);
    try {
      const vectors = await args.embed(entries.map(([, t]) => t));
      const pairs = entries
        .map(([id], i) => ({ unitId: id, vector: vectors[i] }))
        .filter((p) => Array.isArray(p.vector) && p.vector.length > 0);
      embedded = await writer.setEmbeddings(pairs);
      if (embedded === 0 && pairs.length > 0) {
        await reporter?.log(
          "EMBED",
          `0/${pairs.length} vectors persisted — check Surreal permissions or record ids`,
        );
      }
      await reporter?.completeStage("embedding", `${embedded} vector(s) stored`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Embedding failed";
      await reporter?.skipStage("embedding", `${detail.slice(0, 140)} — continuing`);
    }
  } else if (!shouldRunStage("embedding", stop)) {
    await reporter?.skipStage("embedding", "Stop-after gate");
  } else {
    await reporter?.skipStage("embedding", "No embed route configured");
  }

  await reporter?.beginStage("storing", "Finalizing graph persistence", 1);
  await reporter?.completeStage("storing", "Graph records persisted");

  return {
    sources: sources.length,
    units: totalUnits,
    relations: totalRelations,
    chunks: chunksProcessed,
    groups: totalGroups,
    embedded,
    validated: totalValidated,
    repaired: totalRepaired,
    dropped: totalDropped,
    validation: { ...validationBreakdown },
  };
}

/**
 * Write a source record per input to the workspace's graph store.
 * Throws IngestConfigError when no graph store is configured.
 */
export async function writeJobSourcesToGraphStore(
  job: ConnectIngestJobRecord,
): Promise<{ written: number; table: string; provider: string }> {
  const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
  if (!target) {
    throw new IngestConfigError("graph_target_not_configured");
  }
  const sources = parseSources(job.sources);

  // Postgres spine (host Neon): write into workspace-scoped tables when explicitly enabled.
  if (target.provider === "postgres") {
    const flags = resolveModuleFlagsSync();
    if (!isModuleEnabled(flags, "connectNeonGraphStore")) {
      throw new IngestConfigError("connect_neon_graph_store_disabled");
    }
    let written = 0;
    for (const src of sources) {
      await insertConnectGraphSourcePostgres({
        workspaceId: job.workspaceId,
        domainPackId: job.domainPackId,
        jobId: job.id,
        title: src.title ?? src.url ?? "untitled",
        url: src.url ?? null,
        textPreview: src.text ? src.text.slice(0, 500) : null,
        sourceKind: src.url ? "url" : "text",
      });
      written += 1;
    }
    return { written, table: "knowledge_graph_sources", provider: "postgres" };
  }

  // Surreal (Bring-Your-Own) store via HTTP /sql.
  const store = await buildWorkspaceGraphStore(job.workspaceId);
  if (!store) {
    throw new IngestConfigError("graph_target_not_configured");
  }
  const table = await resolveSourceTable(job);
  const nowIso = new Date().toISOString();
  let written = 0;
  for (const src of sources) {
    const content = {
      restormel_workspace_id: job.workspaceId,
      restormel_job_id: job.id,
      title: src.title ?? src.url ?? "untitled",
      url: src.url ?? null,
      text_preview: src.text ? src.text.slice(0, 500) : null,
      source_kind: src.url ? "url" : "text",
      ingested_at: nowIso,
    };
    await store.query(`CREATE ${table} CONTENT ${JSON.stringify(content)};`);
    written += 1;
  }
  return { written, table, provider: "surreal" };
}
