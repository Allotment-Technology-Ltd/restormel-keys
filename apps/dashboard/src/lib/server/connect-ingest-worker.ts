/**
 * Dequeue and process hosted Knowledge Ingest jobs (Phase 10 / 5d stub).
 */
import {
  validateConnectIngestSources,
  type ConnectIngestStageProgress,
} from "@restormel/connect-core";
import {
  claimNextPendingConnectIngestJob,
  updateConnectIngestJobById,
  type ConnectIngestJobRecord,
} from "$lib/server/connect-ingest-jobs";
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
import { parseGraphRevalidateJobMeta } from "$lib/server/connect/graph-revalidate-job";
import { runGraphRevalidation } from "$lib/server/connect/graph-revalidate-service";
import {
  buildKnowledgeStageGenerates,
  isConnectIngestLlmReady,
} from "$lib/server/connect/stage-route-generate";
import { resolveKnowledgeRouteExecutionContextForWorker } from "$lib/server/connect/stage-routing";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";

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

export async function processConnectIngestJobRecord(
  job: ConnectIngestJobRecord
): Promise<void> {
  const reporter = new ConnectIngestProgressReporter(job);
  try {
    const revalidateMeta = parseGraphRevalidateJobMeta(job.sources);
    if (revalidateMeta) {
      await reporter.beginRun("Worker claimed graph re-validation");
      const mode = await resolveConnectIngestWorkerMode(job);
      if (mode === "stub") {
        await runStubIngestWithProgress(job, parseStages(job.stages));
        return;
      }
      try {
        await runGraphRevalidation({ job, meta: revalidateMeta, reporter });
      } catch (err) {
        if (err instanceof IngestConfigError) {
          await reporter.fail(null, err.message);
          return;
        }
        throw err;
      }
      return;
    }

    validateConnectIngestSources(job.sources);
    const stages = parseStages(job.stages);
    await reporter.beginRun("Worker claimed run");

    const mode = await resolveConnectIngestWorkerMode(job);
    if (mode === "stub") {
      await runStubIngestWithProgress(job, stages);
      return;
    }

    // Full mode: run the pack-driven, enforced pipeline into the configured store.
    try {
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
        const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
        if (target?.provider === "surreal") {
          await reporter.log(
            "STORE",
            `Graph written to SurrealDB namespace "${target.namespace}" / database "${target.database}"`,
          );
        }
        await reporter.complete(
          `Run complete — ${stats.units} units, ${stats.relations} relations, ${stats.embedded} embedded`,
          "full",
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
  }
}

export async function runConnectIngestWorkerOnce(): Promise<boolean> {
  const job = await claimNextPendingConnectIngestJob();
  if (!job) return false;
  await processConnectIngestJobRecord(job);
  return true;
}

export async function runConnectIngestWorkerLoop(maxJobs: number): Promise<number> {
  let n = 0;
  for (let i = 0; i < maxJobs; i++) {
    const did = await runConnectIngestWorkerOnce();
    if (!did) break;
    n++;
  }
  return n;
}

/** Best-effort drain after job POST (dev / single-process hosting). */
export function scheduleConnectIngestWorkerDrain(maxDrain = 4): void {
  queueMicrotask(() => {
    void runConnectIngestWorkerLoop(maxDrain).catch((err) => {
      console.error("[connect-ingest-worker] drain failed:", err);
    });
  });
}
