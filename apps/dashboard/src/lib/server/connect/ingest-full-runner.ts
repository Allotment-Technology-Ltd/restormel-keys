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
  askBatchWithCoverageRetry,
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
  planIncrementalReingest,
  completedStageOrderRank,
  laterCompletedStage,
  ENTAILMENT_BATCH_SIZE,
  type EntailmentInput,
  type EvidenceBinding,
  type ExtractionGenerate,
  type EmbeddingPort,
  type GraphIngestContext,
  type ReingestPlan,
  type UnitEntailment,
  type ValidationInput,
} from "@restormel/connect-core";
import {
  buildEvidenceRows,
  buildLayer2StateRows,
  buildVerificationStateRows,
  type EvidenceRow,
} from "$lib/server/connect/evidence-persist";
import {
  buildCarriedValidationRows,
  buildClaimVersionBindings,
  buildSupersededUnitExclusions,
  buildSupersessionRows,
  computeNextClaims,
  sourceKeyForIngestSource,
} from "$lib/server/connect/incremental-reingest";
import {
  buildValidationBatchInputs,
  validateUnitsBatchDetailed,
  remapValidationBatchResults,
  finalizeValidationCoverage,
  type UnitValidation,
} from "@restormel/connect-core/ingest/validation";
import { loadGraphIngestContext } from "$lib/server/connect/graph-ingest-context";
import {
  clearConnectSourceDocumentTextToStore,
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  insertConnectGraphSourcePostgres,
  listConnectDomainPacksForWorkspace,
  type ConnectIngestJobRecord,
} from "$lib/server/neon";
import { fetchSurrealSourceRecordText } from "$lib/server/connect/connect-source-text-resolve";
import type { GraphStore } from "@restormel/graphrag-core";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { requireGraphUnitSourceId } from "$lib/server/connect/graph-ingest-source";
import {
  buildGraphWriter,
  REMOVED_VALIDATION_STATUS,
  type GraphWriter,
} from "$lib/server/connect/graph-writer";
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

/**
 * P2b read-back guard. After writeSource persists the source text into the user's own
 * Surreal store, read it back through the SAME resolver the readers use
 * (`fetchSurrealSourceRecordText` → `resolveSurrealSourceFullText`) and byte-compare it with
 * the bytes evidence was bound against (`boundText`, already trimmed at ingest). Outcomes:
 *
 *   - CONFIRMED (store returns the exact bound bytes): the user's store is authoritative for
 *     this source, so we drop OUR durable Postgres cache copy of the text (metadata row
 *     stays; `provenance.graph_source_key` is stamped so a future re-ingest re-resolves from
 *     the store). This is the ONLY case where new user content stops being cached.
 *   - MISMATCH / MISSING (SCHEMAFULL dropped the inline field, the resolver returned nothing,
 *     or a read error): we KEEP the cache copy untouched (re-validation's emergency fallback)
 *     and log a structured warning so the degradation is visible, never silent.
 *
 * Best-effort and non-fatal: any thrown error is swallowed (cache kept) so the guard can
 * never break a run. No row is deleted and no column is dropped here.
 */
async function reconcileSourceCacheWithStore(args: {
  store: GraphStore | null;
  pack: ConnectDomainPack;
  workspaceId: string;
  sourceId: string;
  title: string | null;
  url: string | null;
  boundText: string;
  reporter?: ConnectIngestProgressReporter;
}): Promise<{ outcome: "confirmed" | "mismatch" | "store_unavailable"; clearedRows: number }> {
  const { store, pack, workspaceId, sourceId, title, url, boundText, reporter } = args;
  if (!store) {
    // No store handle (unreachable BYO store) → keep the cache; never lose the fallback.
    return { outcome: "store_unavailable", clearedRows: 0 };
  }
  try {
    const readback = await fetchSurrealSourceRecordText(store, sourceId, pack);
    // The resolver trims on read; we bound against the trimmed bytes (sourceText), so an
    // exact === comparison is correct here. A trim mismatch would mean the store dropped or
    // mutated the bytes — treat that as a miss and keep the cache.
    const matches = readback.fullText != null && readback.fullText === boundText;
    if (matches) {
      const clearedRows = await clearConnectSourceDocumentTextToStore({
        workspaceId,
        name: title,
        url,
        graphSourceKey: sourceId,
      });
      if (clearedRows > 0) {
        await reporter?.log(
          "INGEST",
          `Source text verified in your store — dropped our cached copy (store is authoritative): ${title ?? url ?? sourceId}`,
        );
      }
      return { outcome: "confirmed", clearedRows };
    }
    // Read-back failed or mismatched — keep the cache and surface the degradation.
    const reason =
      readback.fullText == null
        ? "store read-back returned no inline text (a SCHEMAFULL source table without the text field silently drops it)"
        : "store read-back text did not match the bound bytes";
    console.warn(
      `[ingest-full-runner] P2b read-back guard: ${reason} for source "${title ?? url ?? sourceId}" ` +
        `(${sourceId}) — keeping the Postgres cache copy as the re-validation fallback.`,
    );
    await reporter?.log(
      "INGEST",
      `Kept cached source text (store read-back unconfirmed) for: ${title ?? url ?? sourceId}`,
    );
    return { outcome: "mismatch", clearedRows: 0 };
  } catch (err) {
    console.warn(
      `[ingest-full-runner] P2b read-back guard errored for source "${title ?? url ?? sourceId}" ` +
        `(${sourceId}); keeping the Postgres cache copy. Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { outcome: "mismatch", clearedRows: 0 };
  }
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
  /** Stage 3.2 incremental re-ingest tallies (all zero on first-time ingests). */
  reingest: {
    unchangedSources: number;
    carriedClaims: number;
    changedClaims: number;
    removedClaims: number;
  };
  /** Sources skipped via the durable resume checkpoint (Stage 1.6) — no LLM re-spend. */
  resumedSourcesSkipped: number;
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

  // ── Stage 1.6 durable resume ─────────────────────────────────────────────────
  // A run reclaimed after a stall is re-queued IN PLACE with its checkpoint in
  // progress.resume. Sources counted in `sources_done` finished every per-source
  // LLM stage (extract → … → remediate) before the stall — skip them entirely so
  // a resume never re-spends completed LLM stages. Stage ranks come from the
  // connect-core resume-stage helpers (completedStageOrderRank/laterCompletedStage).
  //
  // NOTE on ordering: this runner embeds AFTER validate/remediate (unlike the
  // SOPHIA pipeline order in INGEST_PIPELINE_STAGES_ORDER, where embedding sits
  // before validating). The post-source tail (embed + finalize) is therefore
  // checkpointed as "storing" — the only rank strictly above every per-source stage.
  const resume = job.progress?.resume ?? null;
  const resumeSourcesDone = Math.min(
    Math.max(0, Math.round(resume?.sources_done ?? 0)),
    sources.length,
  );
  const tailAlreadyDone =
    resumeSourcesDone >= sources.length &&
    completedStageOrderRank(resume?.last_stage_completed) >=
      completedStageOrderRank("storing");
  /** Deepest per-source stage the stop gate lets this run reach. */
  const perSourceLastStage = (["remediating", "validating", "grouping", "relating"] as const).find(
    (stage) => stage === "relating" || shouldRunStage(stage, stop),
  )!;
  let checkpointStage: string | null = resume?.last_stage_completed ?? null;
  if (resumeSourcesDone > 0) {
    await reporter?.log(
      "INGEST",
      `Resuming from checkpoint — ${resumeSourcesDone}/${sources.length} source(s) already completed; their LLM stages will not re-run.`,
    );
  }

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
  // Stage 3.2 incremental re-ingest tallies (verified-memory ADR §3).
  const reingest = { unchangedSources: 0, carriedClaims: 0, changedClaims: 0, removedClaims: 0 };

  // P2b: a single store handle for the per-source read-back guard (built once, reused for
  // every source). Null on a Postgres run (the spine IS the authoritative store, so the
  // cache stays untouched there) or if the BYO store is unreachable (guard then no-ops →
  // cache kept, never lost).
  const readbackStore =
    writer.provider === "surreal"
      ? await buildWorkspaceGraphStore(job.workspaceId).catch(() => null)
      : null;

  if (writer.provider === "surreal") {
    // Stage 3.2b: explicit operator log when the version-table opt-in is OFF.
    // When ON, probeVersionTable eagerly runs DDL; a permission failure degrades to OFF
    // with an operator-visible warning — never blocks the run, never silent.
    if (!writer.allowSurrealVersionTable) {
      await reporter?.log(
        "INGEST",
        "Incremental re-ingest is not enabled for this Surreal BYO store — every source runs a full ingest. " +
          'To enable, turn on "Allow Restormel to manage claim versions in this database" in the graph store settings.',
      );
    } else if (writer.probeVersionTable) {
      const tableReady = await writer.probeVersionTable();
      if (!tableReady) {
        await reporter?.log(
          "INGEST",
          'WARN: "Allow Restormel to manage claim versions in this database" is ON, but ' +
            'the "restormel_claim_versions" table could not be created (permissions) — ' +
            "degrading to full ingest for this run. Check that the Surreal user has DEFINE TABLE permissions, " +
            'or turn off the setting to suppress this warning.',
        );
      } else {
        await reporter?.log(
          "INGEST",
          "Incremental re-ingest enabled — restormel_claim_versions table ready in this Surreal DB.",
        );
      }
    }
  }

  /** Durable checkpoint: every per-source LLM stage for sources[0..idx] is done. */
  const markSourceCheckpoint = async (idx: number) => {
    checkpointStage = laterCompletedStage(checkpointStage, perSourceLastStage);
    await reporter?.setResumeCheckpoint({
      sources_done: idx + 1,
      last_stage_completed: checkpointStage,
    });
  };

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    const src = sources[sourceIndex]!;
    const title = src.title ?? src.url ?? "untitled";
    // P2b trim-fix (gap B): normalize the source bytes ONCE, here, so the SAME trimmed
    // bytes flow into the content hash, chunking, evidence binding (offsets + source_hash),
    // the store-write, AND the cache. Every downstream resolver (`extractInlineSourceText`,
    // `findConnectSourceDocumentText`, `recheckEvidenceSpanAgainstText`) trims on read, so a
    // source with leading/trailing whitespace previously bound against UNtrimmed bytes yet
    // re-resolved to trimmed bytes → deterministic Layer-1 hash_mismatch. Binding against the
    // trimmed bytes makes every read-side `.trim()` a no-op, so the store round-trip and the
    // cache round-trip both hash-match the bound bytes. (Postgres unit text is unchanged — we
    // only re-point the source-text bytes that evidence is pinned to.)
    const sourceText = src.text?.trim() ? src.text.trim() : null;
    // ── Precedence: resume checkpoint (1.6) before re-ingest planner (3.2) ──────
    // 1. The resume-checkpoint skip runs FIRST. A checkpoint for sources[0..idx] is
    //    only ever written AFTER each source's full per-source treatment finished —
    //    including its Stage 3.2 planner decision (hash-skip, or claim diff +
    //    supersession + carry-forward), which always precedes markSourceCheckpoint.
    //    Skipping a checkpointed source is therefore a pure no-op: it can never
    //    bypass an unapplied planner decision, never double-supersedes prior claim
    //    versions, and never re-judges carried claims (no writer calls at all, so
    //    no LLM re-spend either).
    // 2. The Stage 3.2 hash-skip check runs SECOND, for every NON-checkpointed
    //    source — the cheapest remaining check and idempotent (one read plus a
    //    last_seen_at touch), so a resumed source the planner says is unchanged
    //    remains a near-no-op.
    // Both paths count the source as done for progress: the checkpoint is
    // positional (sources_done covers sources[0..n-1]), so EVERY skip path below
    // must advance it via markSourceCheckpoint — otherwise a later stall would
    // resume mis-aligned and re-spend or mis-skip sources.
    if (sourceIndex < resumeSourcesDone) {
      await reporter?.log(
        "INGEST",
        `Checkpoint — skipping completed source ${sourceIndex + 1}/${sources.length}: ${title}`,
      );
      continue;
    }
    // Stage 3.2: stable source identity + content hash decide first-time ingest vs
    // unchanged re-ingest (skip entirely) vs changed re-ingest (diff this source only).
    // Hash the trimmed bytes (P2b) — see the `sourceText` note above.
    const probeHash = sourceText ? await contentHash(sourceText) : null;
    // Anonymous pasted text has no stable identity — key it by content so an unchanged
    // re-paste still skips, while a different paste is simply a new source (it can
    // never supersede an unrelated paste's claims).
    const sourceKey =
      sourceKeyForIngestSource(src) ?? (probeHash ? `content:${probeHash}` : null);
    const prior = probeHash && sourceKey ? await writer.findSourceVersion(sourceKey) : null;
    if (prior?.contentHash && prior.contentHash === probeHash) {
      // ADR §3 step 1: hash unchanged ⇒ skip the document entirely — zero model calls,
      // zero writes beyond the last_seen_at touch (and the resume checkpoint below).
      await writer.touchSourceSeen(prior.sourceId);
      await reporter?.log("INGEST", `Source unchanged (content hash match) — skipped: ${title}`);
      reingest.unchangedSources += 1;
      await markSourceCheckpoint(sourceIndex);
      continue;
    }
    // Record content_hash only when this run will actually process the document —
    // a budget-exhausted registration must not let a later run skip it as "unchanged".
    const willProcess = Boolean(sourceText) && chunkBudget > 0;
    await reporter?.setAction(`Registering source — ${title}`);
    const originatesFromUserGraph = Boolean(src.provenance?.graph_source_key?.trim());
    const sourceId = requireGraphUnitSourceId(
      await writer.writeSource({
        title,
        url: src.url ?? null,
        textPreview: sourceTextPreview(src),
        sourceKind: src.url ? "url" : "text",
        sourceKey,
        contentHash: willProcess ? probeHash : null,
        // P2a: persist the full parsed text into the user's own store (Surreal BYO) so
        // re-validation/evidence/coaching can resolve it on demand — byte-exact with the
        // bytes evidence binds against below (sourceText). Postgres ignores it.
        text: sourceText,
        // P2a guard: a source copied FROM the user's own graph already has its text in the
        // store under the original record — don't re-write/clobber it on this fresh copy.
        originatesFromUserGraph,
      }),
    );
    await reporter?.log(
      "INGEST",
      prior ? `Source changed — re-ingesting: ${title}` : `Source registered — ${title}`,
    );

    // ── P2b read-back guard (gap A): is the user's store provably authoritative? ──
    // We stop durably caching NEW user content in our Postgres ONLY where the store
    // demonstrably holds it. After writeSource, read the text back through the SAME
    // resolver readers use and byte-compare it (modulo trim — the bytes are already
    // trimmed, see `sourceText`). On a confirmed match we clear the Postgres cache copy
    // for this source (metadata row stays — reversible, no DROP/DELETE). On any miss
    // (SCHEMAFULL dropped the field, BYO-origin, Postgres spine, read error) we KEEP the
    // cache so re-validation never breaks, and log a structured warning. Best-effort:
    // the guard never throws into the run.
    if (writer.provider === "surreal" && sourceText && !originatesFromUserGraph) {
      await reconcileSourceCacheWithStore({
        store: readbackStore,
        pack,
        workspaceId: job.workspaceId,
        sourceId,
        title,
        url: src.url ?? null,
        boundText: sourceText,
        reporter,
      });
    }

    if (!sourceText || chunkBudget <= 0) {
      await markSourceCheckpoint(sourceIndex);
      continue;
    }

    // EBV Layer 1: pin this source version once; all evidence spans bind against it.
    // (probeHash — and therefore sourceKey via the content fallback — is non-null here:
    // sourceText passed the guard above.)
    const sourceHash = probeHash as string;
    const claimSourceKey = sourceKey as string;
    const evidenceRows: EvidenceRow[] = [];
    const bindingByUnitId = new Map<string, EvidenceBinding>();
    const evidenceCounts = { bound: 0, unbound: 0, no_evidence: 0 };

    const sourceUnits: { id: string; text: string; type: string | null; chunkIndex: number }[] = [];
    const chunkTextByUnitId = new Map<string, string>();
    const chunks = chunkDocument(sourceText, pack.chunking).slice(0, chunkBudget);
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
      // H3: pass chunk totals so the orphan/dangling ratio gates apply (preset-driven
      // thresholds: production blocks, starter warns via `breaches`).
      const gate = evaluateExtractionGate(
        extraction.warnings,
        preset,
        pack.ontology.schema_mode,
        { totals: { units: extraction.units.length, relations: extraction.relations.length } },
      );
      if (!gate.allowPersist) {
        await reporter?.log(
          "EXTRACT",
          `Chunk ${i + 1} skipped — production gate (${(gate.breaches ?? [gate.reason ?? "blocked"]).join(", ")})`,
        );
        continue;
      }
      if (gate.breaches?.length) {
        await reporter?.log(
          "EXTRACT",
          `Chunk ${i + 1} quality gate warning (persisted, ${preset} preset) — ${gate.breaches.join(", ")}`,
        );
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
        sourceText,
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

    // Stage 3.2: deterministic claim identity → carried/changed/added/removed diff
    // against ALL current claims under this stable source key (verified-memory ADR §3
    // step 2) — keyed by source_key so older generations can never be silently kept.
    const priorClaims = prior ? await writer.listCurrentClaimVersions(claimSourceKey) : [];
    const nextClaims = await computeNextClaims({ sourceKey: claimSourceKey, rows: evidenceRows });
    const plan: ReingestPlan = planIncrementalReingest({ prior: priorClaims, next: nextClaims });
    const carriedUnitIds = new Set(plan.carried.map((c) => c.next.unitId));
    if (priorClaims.length > 0) {
      reingest.carriedClaims += plan.carried.length;
      reingest.changedClaims += plan.changed.length;
      reingest.removedClaims += plan.removed.length;
      await reporter?.log(
        "INGEST",
        `Re-ingest diff — ${plan.carried.length} carried, ${plan.changed.length} changed, ` +
          `${plan.added.length} new, ${plan.removed.length} removed (${title})`,
      );
    }

    /**
     * Close the replaced/removed prior versions' validity windows (chained forward to
     * their successor version when one exists) and soft-exclude the prior unit records.
     * Reversible and provenance-chained — never orphaned, never silently kept.
     */
    const applySupersessions = async (versionIdByUnitId: Map<string, string>) => {
      const rows = buildSupersessionRows({ plan, versionIdByUnitId });
      if (rows.length === 0) return;
      const sup = await writer.supersedeClaimVersions(rows);
      // Soft-exclude the prior unit records in ONE batched write (same remediation
      // soft-exclude semantics as excludeUnit: hidden from retrieval, reversible).
      await writer.setValidation(
        buildSupersededUnitExclusions(plan).map((ex) => ({
          unitId: ex.unitId,
          status: REMOVED_VALIDATION_STATUS,
          note: ex.note,
        })),
      );
      await reporter?.log(
        "INGEST",
        `Supersession chain — ${sup.persisted} prior claim version(s) closed` +
          (sup.missed > 0 ? `, ${sup.missed} not persisted (store schema)` : ""),
      );
    };

    if (sourceUnits.length === 0) {
      // A changed document that now yields no claims still supersedes its prior ones —
      // applied BEFORE the checkpoint so a checkpointed source is always fully settled.
      await applySupersessions(new Map());
      await markSourceCheckpoint(sourceIndex);
      continue;
    }

    if (evidenceRows.length > 0) {
      const ev = await writer.setEvidence({
        sourceHash,
        bindings: buildClaimVersionBindings({ rows: evidenceRows, next: nextClaims, plan }),
      });
      await reporter?.log(
        "EXTRACT",
        `Evidence: ${evidenceCounts.bound}/${evidenceRows.length} bound` +
          (evidenceCounts.unbound ? `, ${evidenceCounts.unbound} unbound` : "") +
          (evidenceCounts.no_evidence ? `, ${evidenceCounts.no_evidence} without a quote` : "") +
          (ev.missed > 0 ? ` — ${ev.missed} write(s) not persisted (store schema; see EBV docs)` : ""),
      );
      await applySupersessions(ev.versionIdByUnitId);
    } else {
      await applySupersessions(new Map());
    }

    // Carry-forward (no model calls): unchanged claims keep their verification state,
    // judge attribution and original judged_at — copied onto their new version rows at
    // insert (setEvidence). Only the unit-level validation verdict still needs writing.
    if (plan.carried.length > 0) {
      const carriedValidations = buildCarriedValidationRows(plan);
      if (carriedValidations.length > 0) {
        totalValidated += await writer.setValidation(carriedValidations);
        for (const v of carriedValidations) {
          if (v.status === "ok") validationBreakdown.ok += 1;
          else if (v.status === "weak") validationBreakdown.weak += 1;
          else if (v.status === "unsupported") validationBreakdown.unsupported += 1;
        }
      }
      await reporter?.log(
        "VALIDATE",
        `${plan.carried.length} unchanged claim(s) carried forward — verification state kept, no re-judging`,
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
      // Stage 3.2: carried claims were settled above — judge only changed/new units,
      // so re-validation cost is O(changed claims), never O(graph).
      const unitsToJudge = sourceUnits.filter((u) => !carriedUnitIds.has(u.id));
      const unitInputs = unitsToJudge.map((u) => ({ ref: u.id, text: u.text }));
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
              // H1: a lost batch (unparseable/truncated response or omitted refs) is
              // logged as a coverage shortfall and re-asked exactly once; refs still
              // missing then fall through to the fail-safe "weak" coverage finalize.
              const asked = await askBatchWithCoverageRetry<ValidationInput, UnitValidation>({
                inputs: batchUnits,
                ask: (units) =>
                  validateUnitsBatchDetailed({
                    units,
                    sourceText,
                    pack,
                    generate: args.generates.validation,
                    qualityPreset: preset,
                    graphContext,
                  }),
                onShortfall: async ({ omittedRefs, parseFailed }) => {
                  await reporter?.log(
                    "VALIDATE",
                    `Coverage shortfall in batch ${bi + 1}/${batches.length} — ` +
                      `${omittedRefs.length}/${batchUnits.length} verdict(s) missing` +
                      (parseFailed ? " (response unparseable)" : "") +
                      " — re-asking once",
                  );
                },
              });
              merged.push(...remapValidationBatchResults(asked.results, refToUnitId));
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
          // Stage 3.2: carried claims are excluded — their verdicts were copied above.
          const inputs: EntailmentInput[] = unitsToJudge.map((u) => {
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
                // H1: a lost judge batch is logged and re-asked exactly once inside
                // judgeEntailment; still-missing refs abstain (coverage_gap → review).
                onCoverageShortfall: async ({ omittedRefs, parseFailed }) => {
                  await reporter?.log(
                    "VALIDATE",
                    `Coverage shortfall — judge omitted ${omittedRefs.length} claim(s)` +
                      (parseFailed ? " (response unparseable)" : "") +
                      " — re-asking once",
                  );
                },
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
          sourceText,
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

    await markSourceCheckpoint(sourceIndex);
  }

  let embedded = 0;
  if (resumeSourcesDone > 0 && !tailAlreadyDone) {
    // Embedding runs at the END of a run, so units from checkpointed sources never
    // got vectors before the stall and are not re-embedded here (their LLM stages
    // are not re-run). Operator-visible pointer to the recovery tool:
    await reporter?.log(
      "EMBED",
      `Resumed run — vectors for the ${resumeSourcesDone} checkpointed source(s) may be missing; run an embedding backfill if coverage is low.`,
    );
  }
  if (tailAlreadyDone) {
    await reporter?.skipStage(
      "embedding",
      "Checkpoint — embeddings completed before the stall",
    );
  } else if (args.embed && embedText.size > 0 && shouldRunStage("embedding", stop)) {
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
  // Tail checkpoint: embed + finalize done — a reclaim past this point resumes to
  // a no-op instead of re-embedding (see the ordering note above).
  checkpointStage = laterCompletedStage(checkpointStage, "storing");
  await reporter?.setResumeCheckpoint({
    sources_done: sources.length,
    last_stage_completed: checkpointStage,
  });

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
    reingest: { ...reingest },
    resumedSourcesSkipped: resumeSourcesDone,
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
