/**
 * Dequeue and process hosted Knowledge Ingest jobs (Phase 10 / 5d stub).
 */
import {
  validateConnectIngestSources,
  resolveQualityPreset,
  type ConnectIngestStageProgress,
} from "@restormel/connect-core";
import { randomUUID } from "node:crypto";
import {
  claimNextPendingConnectIngestJob,
  heartbeatConnectIngestJobLease,
  reclaimStaleRunningConnectIngestJobs,
  updateConnectIngestJobById,
  getConnectIngestJobForWorkspace,
  appendConnectIngestJobLog,
  CONNECT_INGEST_DEFAULT_LEASE_MS,
  type ConnectIngestJobRecord,
} from "$lib/server/connect-ingest-jobs";
import { formatBracketLogLine } from "$lib/connect/bracket-log-timeline";
import { toPublicConnectIngestQualityReport } from "$lib/server/neon";
import { dispatchConnectIngestWebhooks } from "$lib/server/connect-v1/connect-webhook-delivery";
import {
  ConnectIngestProgressReporter,
  runStubIngestWithProgress,
} from "$lib/server/connect-ingest-progress";
import { resolveConnectIngestWorkerMode } from "$lib/server/connect-ingest-worker-mode";
import {
  IngestConfigError,
  buildJobWriter,
  runFullExtraction,
  writeJobSourcesToGraphStore,
} from "$lib/server/connect/ingest-full-runner";
import { parseGraphEmbedBackfillJobMeta } from "$lib/server/connect/graph-embed-backfill-job";
import { runGraphEmbedBackfill } from "$lib/server/connect/graph-embed-backfill-service";
import { parseGraphLinkSourcesJobMeta } from "$lib/server/connect/graph-source-link-job";
import { runGraphSourceLinking } from "$lib/server/connect/graph-source-link-service";
import { parseGraphRevalidateJobMeta } from "$lib/server/connect/graph-revalidate-job";
import { runGraphRevalidation } from "$lib/server/connect/graph-revalidate-service";
import {
  buildKnowledgeStageGenerates,
  isConnectIngestLlmReady,
} from "$lib/server/connect/stage-route-generate";
import {
  resolveKnowledgeRouteExecutionContextForWorker,
  type ConnectRouteExecutionContext,
} from "$lib/server/connect/stage-routing";
import {
  StageAttributionCollector,
  deriveValidationFamilyAttribution,
} from "$lib/server/connect/stage-attribution";
import { getConnectGraphTargetForWorkspace, getConnectDomainPackById, insertRequestLog } from "$lib/server/neon";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { invalidateConnectGraphStatsCache } from "$lib/server/neon";
import { resolveConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import { buildRunQualityReport } from "$lib/server/connect/run-quality-report";
import { assessPackReadiness } from "$lib/server/connect/pack-readiness";
import {
  captureServerPostHogEvent,
  workspacePostHogDistinctId,
} from "$lib/server/posthog-capture";
import { resolveModuleFlags } from "$lib/server/module-flags";

async function resolveJobQualityPreset(job: ConnectIngestJobRecord) {
  if (!job.domainPackId) return resolveQualityPreset(null);
  const row = await getConnectDomainPackById({ id: job.domainPackId, workspaceId: job.workspaceId });
  if (!row) return resolveQualityPreset(null);
  try {
    return resolveQualityPreset(domainPackRecordToApi(row));
  } catch {
    return resolveQualityPreset(null);
  }
}

function parseStages(raw: unknown): ConnectIngestStageProgress[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
      const rec = row as Record<string, unknown>;
      return {
        stage: String(rec.stage),
        status: String(rec.status),
        ...(typeof rec.started_at === "string" ? { started_at: rec.started_at } : {}),
        ...(typeof rec.completed_at === "string" ? { completed_at: rec.completed_at } : {}),
        ...(typeof rec.error === "string" ? { error: rec.error } : {}),
      } as ConnectIngestStageProgress;
    });
}

/**
 * Advance a readiness run's status as its cohort jobs run. No-op when the job
 * isn't part of a run (cohortRunId null) or the update fails — run tracking must
 * never break job processing.
 */
async function advanceReadinessRunPhase(
  workspaceId: string,
  cohortRunId: string | null | undefined,
  phase: "linking" | "linked" | "embedding" | "embedded" | "validating",
): Promise<void> {
  if (!cohortRunId) return;
  try {
    const { markReadinessRunPhase } = await import(
      "$lib/server/connect/readiness-runs-service"
    );
    await markReadinessRunPhase({ runId: cohortRunId, workspaceId, phase });
  } catch {
    // Run tracking is best-effort.
  }
}

/** Mark a readiness run complete and roll up its cohort's validation quality. */
async function finishReadinessRunValidation(
  workspaceId: string,
  cohortRunId: string | null | undefined,
  counts?: { ok: number; weak: number; unsupported: number },
): Promise<void> {
  if (!cohortRunId) return;
  try {
    const { markReadinessRunPhase, rollupReadinessRunQuality, summariseReadinessRunCounts } =
      await import("$lib/server/connect/readiness-runs-service");
    // Prefer the in-memory tally from the run (authoritative, no store read-back).
    // Fall back to a re-query only when no verdicts were tallied (e.g. trust mode
    // skipped everything, or an older job shape without counts).
    const tallied = counts ? counts.ok + counts.weak + counts.unsupported : 0;
    const qualitySummary =
      counts && tallied > 0
        ? await summariseReadinessRunCounts({ runId: cohortRunId, workspaceId, counts })
        : await rollupReadinessRunQuality({ runId: cohortRunId, workspaceId });
    await markReadinessRunPhase({
      runId: cohortRunId,
      workspaceId,
      phase: "complete",
      qualitySummary,
    });
  } catch {
    // Run tracking is best-effort.
  }
}

export async function processConnectIngestJobRecord(
  job: ConnectIngestJobRecord
): Promise<void> {
  const reporter = new ConnectIngestProgressReporter(job);
  try {
    const linkSourcesMeta = parseGraphLinkSourcesJobMeta(job.sources);
    if (linkSourcesMeta) {
      await reporter.beginRun("Worker claimed graph source linking");
      const mode = await resolveConnectIngestWorkerMode(job);
      if (mode === "stub") {
        await runStubIngestWithProgress(job, parseStages(job.stages));
        return;
      }
      await advanceReadinessRunPhase(job.workspaceId, linkSourcesMeta.cohort_run_id, "linking");
      try {
        await runGraphSourceLinking({ job, meta: linkSourcesMeta, reporter });
      } catch (err) {
        if (err instanceof IngestConfigError) {
          await reporter.fail(null, err.message);
          return;
        }
        throw err;
      }
      await advanceReadinessRunPhase(job.workspaceId, linkSourcesMeta.cohort_run_id, "linked");
      return;
    }

    const embedBackfillMeta = parseGraphEmbedBackfillJobMeta(job.sources);
    if (embedBackfillMeta) {
      await reporter.beginRun("Worker claimed graph embed backfill");
      const mode = await resolveConnectIngestWorkerMode(job);
      if (mode === "stub") {
        await runStubIngestWithProgress(job, parseStages(job.stages));
        return;
      }
      await advanceReadinessRunPhase(job.workspaceId, embedBackfillMeta.cohort_run_id, "embedding");
      try {
        await runGraphEmbedBackfill({ job, meta: embedBackfillMeta, reporter });
      } catch (err) {
        if (err instanceof IngestConfigError) {
          await reporter.fail(null, err.message);
          return;
        }
        throw err;
      }
      await advanceReadinessRunPhase(job.workspaceId, embedBackfillMeta.cohort_run_id, "embedded");
      return;
    }

    const revalidateMeta = parseGraphRevalidateJobMeta(job.sources);
    if (revalidateMeta) {
      await reporter.beginRun("Worker claimed graph re-validation");
      const mode = await resolveConnectIngestWorkerMode(job);
      if (mode === "stub") {
        await runStubIngestWithProgress(job, parseStages(job.stages));
        return;
      }
      await advanceReadinessRunPhase(job.workspaceId, revalidateMeta.cohort_run_id, "validating");
      let revalidateResult: Awaited<ReturnType<typeof runGraphRevalidation>> | null = null;
      try {
        revalidateResult = await runGraphRevalidation({ job, meta: revalidateMeta, reporter });
      } catch (err) {
        if (err instanceof IngestConfigError) {
          await reporter.fail(null, err.message);
          return;
        }
        throw err;
      }
      await finishReadinessRunValidation(
        job.workspaceId,
        revalidateMeta.cohort_run_id,
        revalidateResult?.validationCounts,
      );
      return;
    }

    validateConnectIngestSources(job.sources);
    const stages = parseStages(job.stages);
    const resumedSources = job.progress?.resume?.sources_done ?? 0;
    await reporter.beginRun(
      resumedSources > 0
        ? `Worker resumed run from checkpoint — ${resumedSources} source(s) already complete`
        : "Worker claimed run",
    );

    const mode = await resolveConnectIngestWorkerMode(job);
    if (mode === "stub") {
      const quality = await resolveJobQualityPreset(job);
      if (quality.preset === "production") {
        await reporter.log(
          "INGEST",
          "Production preset selected but worker is in stub mode — connect a graph store for a real ingest.",
        );
      }
      await runStubIngestWithProgress(job, stages);
      return;
    }

    // Full mode: run the pack-driven, enforced pipeline into the configured store.
    try {
      const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
      if (!target) throw new IngestConfigError("graph_target_not_configured");
      const baseRouteCtx = await resolveKnowledgeRouteExecutionContextForWorker({
        workspaceId: job.workspaceId,
        projectId: job.projectId,
      });
      // K5: capture which route/step/provider/model serves each stage AT RUN TIME.
      // The collector accumulates last-successful-attempt attribution; hooks below
      // drain it into the reporter (persisted into job progress) and tag each resolve
      // into request logs (source=connect_ingest) so Logs/Usage see Connect traffic.
      // Capture is best-effort — hooks never throw into the pipeline.
      const attribution = new StageAttributionCollector();
      // RES-113 PR-I: the structured backoff signal → amber rate-limit state is the NEW
      // behaviour and is gated behind the workspace's onboardingJourney flag. With the
      // flag OFF (prod default) we install NO onBackoff hook, so the executor's retry
      // timing and the persisted job shape are byte-identical to today (REC-ADR-021 §4:
      // the whole RES-113 cut is one flagged release). Flag read is best-effort —
      // failing closed (no wiring) on any error keeps current behaviour.
      const backoffSignalEnabled = await resolveModuleFlags(
        workspacePostHogDistinctId(job.workspaceId),
      )
        .then((flags) => flags.onboardingJourney)
        .catch(() => false);
      const routeCtx: ConnectRouteExecutionContext | null = baseRouteCtx
        ? {
            ...baseRouteCtx,
            onStageServed: (stage, snap) => {
              // Record in-memory always; only persist to job progress when the served
              // route/provider/model/attempts actually changed — extraction re-resolves
              // per chunk, so an unconditional persist would be one DB write per chunk.
              const { entry, changed } = attribution.record(stage, snap);
              if (changed) {
                void reporter.recordStageAttribution(stage, entry).catch(() => {});
              }
              // A stage that just resolved successfully is no longer backing off —
              // clear any amber overlay so it never lingers past the throttle.
              if (backoffSignalEnabled) {
                void reporter.clearBackoff().catch(() => {});
              }
            },
            // Only present when the flag is ON → flag-OFF is unchanged behaviour.
            ...(backoffSignalEnabled
              ? {
                  onBackoff: (signal) => {
                    void reporter
                      .signalBackoff(signal.stage, {
                        reasonCode: signal.reasonCode,
                        attempt: signal.attempt,
                        delayMs: signal.delayMs,
                        at: signal.at,
                      })
                      .catch(() => {});
                  },
                }
              : {}),
            onResolveAttempt: (stage, rec) => {
              void insertRequestLog({
                workspaceId: baseRouteCtx.workspaceId,
                projectId: baseRouteCtx.projectId,
                environmentId: baseRouteCtx.environmentId,
                providerType: rec.provider ?? "unknown",
                requestStatus: rec.status, // "resolved" | "failed"
                latencyMs: rec.latencyMs,
                routeId: rec.routeId ?? null,
                finalModelId: rec.modelId ?? null,
                errorCode: rec.errorCode ?? null,
                fallbackCount: rec.attemptNumber > 0 ? rec.attemptNumber : null,
                // source tag drives the /logs "connect_ingest" badge + W3.3 filter.
                metadata: { source: "connect_ingest", stage, ingest_job_id: job.id },
              }).catch(() => {});
            },
          }
        : null;
      const packRow = job.domainPackId
        ? await getConnectDomainPackById({ id: job.domainPackId, workspaceId: job.workspaceId })
        : null;
      let packApi = null;
      if (packRow) {
        try {
          packApi = domainPackRecordToApi(packRow);
        } catch {
          packApi = null;
        }
      }
      const quality = await resolveJobQualityPreset(job);
      if (
        quality.preset === "production" &&
        packApi?.cross_model_validation &&
        routeCtx?.routing.routes?.extraction &&
        routeCtx.routing.routes.extraction === routeCtx.routing.routes.validation
      ) {
        await reporter.fail(
          null,
          "cross_model_validation_required: production preset requires different extraction and validation routes.",
        );
        return;
      }
      if (
        packApi?.cross_model_validation &&
        routeCtx?.routing.routes?.extraction &&
        routeCtx.routing.routes.extraction === routeCtx.routing.routes.validation
      ) {
        await reporter.log(
          "INGEST",
          "Cross-model validation is on but extraction and validation share the same route — use different providers for best faithfulness.",
        );
      }
      if (packApi) {
        const readiness = assessPackReadiness(packApi);
        for (const w of readiness) {
          await reporter.log("INGEST", `Pack readiness — ${w}`);
        }
      }
      const llmReady = await isConnectIngestLlmReady({
        workspaceId: job.workspaceId,
        routeCtx,
      });
      const writer = llmReady ? await buildJobWriter(job) : null;
      if (writer) {
        const { generates, embed } = await buildKnowledgeStageGenerates({
          workspaceId: job.workspaceId,
          routeCtx,
        });
        const stats = await runFullExtraction({
          job,
          writer,
          generates,
          embed,
          reporter,
        });
        // Zero new units is a legitimate near-no-op in two cases that compose
        // (Stage 3.2 × Stage 1.6): a re-ingest where sources were unchanged (hash
        // match), and a resumed run that skipped checkpointed sources. Either way
        // — including a resumed all-unchanged re-ingest — the run is a success;
        // only fail a production run that produced nothing from scratch.
        if (
          quality.preset === "production" &&
          stats.units === 0 &&
          stats.reingest.unchangedSources === 0 &&
          stats.resumedSourcesSkipped === 0
        ) {
          await reporter.fail(null, "production_run_zero_units");
          return;
        }
        // Store-aware stats: a Surreal BYO store isn't visible to the Postgres-spine
        // query, so a force-refresh recomputes counts against the store that was
        // actually written. Falls back to the run's in-memory verdict tally if the
        // store can't be read — otherwise Surreal runs always reported "0% supported,
        // no trust score" even on a clean ingest.
        const graphStats = await resolveConnectGraphStats(job.workspaceId, {
          forceRefresh: true,
        }).catch(() => null);
        const storeStatsUsable = !!graphStats && graphStats.units > 0;
        const tally = stats.validation;
        const validation = storeStatsUsable
          ? graphStats!.validation
          : {
              ok: tally.ok,
              weak: tally.weak,
              unsupported: tally.unsupported,
              unvalidated: Math.max(0, stats.units - tally.ok - tally.weak - tally.unsupported),
            };
        const effectiveGraphStats = storeStatsUsable
          ? graphStats!
          : stats.units > 0
            ? { units: stats.units, embedded: stats.embedded, validation }
            : undefined;
        const qualityReport = buildRunQualityReport({
          preset: quality.preset,
          executionMode: "full",
          units: stats.units,
          relations: stats.relations,
          embedded: stats.embedded,
          validation,
          graphStats: effectiveGraphStats,
          packReadinessWarnings: packApi ? assessPackReadiness(packApi) : [],
          // K4/K-P1-7: validating-family disclosure now sourced from K5's captured
          // attribution (the providers that ACTUALLY served extraction vs validation
          // this run) — undefined for legacy/route-less runs → graceful absent-state.
          ...(deriveValidationFamilyAttribution(attribution.snapshot())
            ? { attribution: deriveValidationFamilyAttribution(attribution.snapshot()) }
            : {}),
        });
        await captureServerPostHogEvent(
          workspacePostHogDistinctId(job.workspaceId),
          "connect_ingest_completed",
          {
            ingest_job_id: job.id,
            pack_archetype: packApi?.archetype ?? packApi?.slug ?? null,
            quarantine_count: qualityReport.quarantine_count,
            quarantine_pct: qualityReport.quarantine_pct,
            weak_pct: qualityReport.weak_pct,
            unsupported_pct: qualityReport.unsupported_pct,
            ok_pct: qualityReport.ok_pct,
            units: stats.units,
          },
        );
        const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
        if (target?.provider === "surreal") {
          await reporter.log(
            "STORE",
            `Graph written to SurrealDB namespace "${target.namespace}" / database "${target.database}"`,
          );
        }
        if (qualityReport.kg_audit) {
          await reporter.log(
            "INGEST",
            `Quality report — ${qualityReport.ok_pct}% ok, trust score ${qualityReport.kg_audit.trust_score}`,
          );
        }
        // K5: flush the collector's full snapshot so the completed row carries every
        // captured stage even if a per-stage persist was still in flight.
        reporter.setAttribution(attribution.snapshot());
        await reporter.complete(
          `Run complete — ${stats.units} units, ${stats.relations} relations, ${stats.embedded} embedded`,
          "full",
          { quality_report: qualityReport },
        );
      } else {
        await reporter.beginStage("storing", "Writing source records (LLM routes unavailable)");
        const result = await writeJobSourcesToGraphStore(job);
        if (result.provider === "surreal") {
          const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
          await reporter.log(
            "STORE",
            `Source records in table "${result.table}" — namespace "${target?.namespace}" / database "${target?.database}"`,
          );
        }
        await reporter.completeStage(
          "storing",
          `Stored ${result.written} source(s) in ${result.provider}`,
        );
        await reporter.complete("Source write complete", "full");
      }
    } catch (err) {
      if (err instanceof IngestConfigError) {
        await reporter.fail(null, err.message);
        return;
      }
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_worker_failed";
    await reporter.fail(null, message.slice(0, 500));
  } finally {
    // Any job (ingest / re-validate / embed / link) may have changed the graph —
    // drop the cached stats so the next Connect load recomputes fresh counts.
    await invalidateConnectGraphStatsCache({ workspaceId: job.workspaceId }).catch(() => {});
    // Fire ingest webhooks once the job has reached a terminal state (I1).
    await maybeDispatchConnectIngestWebhooks(job).catch((e) => {
      console.error("[connect-webhook] dispatch hook failed", e);
    });
  }
}

/** Re-read the job's terminal state and fire registered webhooks (fire-and-forget). */
async function maybeDispatchConnectIngestWebhooks(job: ConnectIngestJobRecord): Promise<void> {
  const fresh = await getConnectIngestJobForWorkspace({
    jobId: job.id,
    workspaceId: job.workspaceId,
    ...(job.projectId ? { projectId: job.projectId } : {}),
  });
  if (!fresh || (fresh.status !== "completed" && fresh.status !== "failed")) return;
  const qualityReport = toPublicConnectIngestQualityReport(fresh.progress?.quality_report, {
    stages: fresh.stages,
    updatedAtMs: fresh.updatedAt,
  });
  dispatchConnectIngestWebhooks({
    jobId: fresh.id,
    workspaceId: fresh.workspaceId,
    status: fresh.status,
    qualityReport,
  });
}

/**
 * Stage 1.6 durable runs — worker identity + lease/heartbeat cadence.
 * The lease must comfortably exceed the heartbeat interval so one missed beat
 * (slow event loop, transient Neon error) never triggers a reclaim.
 */
const CONNECT_INGEST_WORKER_ID = `ingest-${process.pid}-${randomUUID().slice(0, 8)}`;

export function connectIngestLeaseMs(): number {
  const raw = Number(process.env.CONNECT_INGEST_LEASE_MS);
  if (!Number.isFinite(raw) || raw < 30_000) return CONNECT_INGEST_DEFAULT_LEASE_MS;
  return Math.min(raw, 60 * 60_000);
}

export function connectIngestWorkerHeartbeatMs(): number {
  const raw = Number(process.env.CONNECT_INGEST_WORKER_HEARTBEAT_MS);
  const fallback = Math.max(5_000, Math.floor(connectIngestLeaseMs() / 5));
  if (!Number.isFinite(raw) || raw < 1_000) return Math.min(fallback, 60_000);
  return raw;
}

/**
 * Worker-loop heartbeat (independent of the progress reporter — a stage stuck in
 * an awaited upstream call still beats). Extends the job's lease until stopped.
 * Returns a stop function; ALWAYS call it in `finally`.
 */
export function startConnectIngestWorkerHeartbeat(
  job: Pick<ConnectIngestJobRecord, "id" | "workerId">,
  opts?: { intervalMs?: number; leaseMs?: number },
): () => void {
  const workerId = job.workerId ?? CONNECT_INGEST_WORKER_ID;
  const intervalMs = opts?.intervalMs ?? connectIngestWorkerHeartbeatMs();
  const leaseMs = opts?.leaseMs ?? connectIngestLeaseMs();
  const id = setInterval(() => {
    void heartbeatConnectIngestJobLease({ id: job.id, workerId, leaseMs }).then(
      (alive) => {
        if (!alive) {
          console.warn(
            `[connect-ingest-worker] heartbeat lost job ${job.id} (cancelled or reclaimed) — lease no longer ours`,
          );
        }
      },
      (err) => {
        console.error("[connect-ingest-worker] heartbeat failed:", err);
      },
    );
  }, intervalMs);
  // Never keep a process alive just to heartbeat (dev / scripts).
  if (typeof id === "object" && id !== null && "unref" in id) id.unref();
  return () => clearInterval(id);
}

/**
 * Reclaim stale 'running' jobs whose worker lease expired (recycled instance,
 * crash). Each reclaimed job becomes a visible, restartable failure: status
 * 'failed' + `worker_lost` error (atomic UPDATE … RETURNING in neon.ts) plus an
 * operator-facing run-console event — never a silent re-run. Restarting resumes
 * from the job's persisted completed-stage checkpoint.
 */
export async function reclaimStaleConnectIngestRuns(): Promise<number> {
  const reclaimed = await reclaimStaleRunningConnectIngestJobs({
    staleMs: connectIngestLeaseMs(),
  });
  for (const job of reclaimed) {
    await appendConnectIngestJobLog({
      jobId: job.id,
      line: formatBracketLogLine(
        "FATAL",
        "Run reclaimed after stall — the worker stopped heartbeating (instance recycled or crashed). " +
          "Restart the run to resume from the last completed checkpoint.",
      ),
    }).catch(() => {});
    // Reclaim is a terminal failure — notify registered ingest webhooks.
    await maybeDispatchConnectIngestWebhooks(job).catch((e) => {
      console.error("[connect-webhook] reclaim dispatch hook failed", e);
    });
  }
  return reclaimed.length;
}

export async function runConnectIngestWorkerOnce(): Promise<boolean> {
  const job = await claimNextPendingConnectIngestJob({
    workerId: CONNECT_INGEST_WORKER_ID,
    leaseMs: connectIngestLeaseMs(),
  });
  if (!job) return false;
  // Heartbeat is owned by the worker loop (not the progress reporter) so the lease
  // stays alive even while a stage is stuck awaiting a slow upstream call.
  const stopHeartbeat = startConnectIngestWorkerHeartbeat(job);
  try {
    await processConnectIngestJobRecord(job);
  } finally {
    stopHeartbeat();
  }
  return true;
}

export async function runConnectIngestWorkerLoop(maxJobs: number): Promise<number> {
  // Honor lease expiry before claiming: surface any stalled run as a restartable
  // failure first so the queue never wedges behind a phantom 'running' job.
  await reclaimStaleConnectIngestRuns().catch((err) => {
    console.error("[connect-ingest-worker] reclaim failed:", err);
  });
  let n = 0;
  for (let i = 0; i < maxJobs; i++) {
    const did = await runConnectIngestWorkerOnce();
    if (!did) break;
    n++;
  }
  return n;
}

/**
 * Cron-drain entrypoint (Stage 1.6): processes the queue OUTSIDE the user request
 * path. Called by the Vercel cron route (`/keys/dashboard/api/connect/ingest/drain`,
 * route-level maxDuration) and designed so a long-lived worker process (Coolify,
 * Stage 2 of the infra migration) can call the same function on an interval and
 * replace the cron entirely.
 */
export async function drainConnectIngestQueue(opts?: {
  maxJobs?: number;
}): Promise<{ reclaimed: number; processed: number }> {
  const maxJobs = Math.min(Math.max(1, Math.round(opts?.maxJobs ?? 3)), 10);
  const reclaimed = await reclaimStaleConnectIngestRuns().catch((err) => {
    console.error("[connect-ingest-worker] reclaim failed:", err);
    return 0;
  });
  let processed = 0;
  for (let i = 0; i < maxJobs; i++) {
    const did = await runConnectIngestWorkerOnce();
    if (!did) break;
    processed++;
  }
  return { reclaimed, processed };
}

/**
 * Vercel request-context `waitUntil` (the same hook `@vercel/functions` uses,
 * accessed via its public global symbol so we need no extra dependency). Without
 * it, serverless/fluid compute may suspend the instance as soon as the HTTP
 * response is flushed — killing the detached ingest drain mid-run with no error
 * and leaving the job stuck in `running` (the "randomly frozen run" symptom).
 * No-op outside Vercel (dev / self-hosted keep the plain detached promise).
 */
export function vercelWaitUntil(promise: Promise<unknown>): boolean {
  try {
    const ctx = (
      globalThis as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } }>
    )[Symbol.for("@vercel/request-context")]?.get?.();
    if (ctx?.waitUntil) {
      ctx.waitUntil(promise);
      return true;
    }
  } catch {
    // Fall through — detached promise behavior unchanged.
  }
  return false;
}

/**
 * Inline post-POST drain gate (Coolify migration Stage 2.2).
 *
 * Default ON — dev, Vercel prod and previews keep today's behavior (the request
 * that queued a job also kicks a best-effort drain). On Coolify the dashboard
 * container sets `CONNECT_INGEST_INLINE_DRAIN=0` so the dedicated worker daemon
 * owns ALL draining and ingest never executes on the interactive event loop
 * (the F9 fix). Lease-based claiming already makes overlapping drainers safe,
 * but gating avoids pointless double execution on a single box.
 */
export function connectIngestInlineDrainEnabled(): boolean {
  const raw = process.env.CONNECT_INGEST_INLINE_DRAIN?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return !["0", "false", "off", "no"].includes(raw);
}

/**
 * Best-effort drain after job POST (dev / single-process hosting).
 * No-op when `CONNECT_INGEST_INLINE_DRAIN=0` — the worker daemon drains instead.
 */
export function scheduleConnectIngestWorkerDrain(maxDrain = 4): void {
  if (!connectIngestInlineDrainEnabled()) return;
  queueMicrotask(() => {
    const drain = runConnectIngestWorkerLoop(maxDrain).catch((err) => {
      console.error("[connect-ingest-worker] drain failed:", err);
    });
    vercelWaitUntil(drain);
  });
}
