/**
 * Background queue: claim queued jobs and run the hosted runtime pipeline.
 * Use `runHostedRuntimeWorkerLoop` from a cron script or after async POST (best-effort drain).
 */
import {
  claimNextQueuedHostedRuntimeJob,
  getHostedRuntimeJobById,
  updateHostedRuntimeJobById,
} from "$lib/server/db";
import { runHostedRuntimeJobPipeline } from "$lib/server/hosted-runtime-job-runner";

/** Process one queued job (SKIP LOCKED). Returns true if a job was claimed and processed. */
export async function runHostedRuntimeWorkerOnce(): Promise<boolean> {
  const job = await claimNextQueuedHostedRuntimeJob();
  if (!job) return false;

  const row = await getHostedRuntimeJobById(job.id);
  if (!row) return false;
  if (row.cancelRequestedAt != null && row.cancelRequestedAt > 0) {
    await updateHostedRuntimeJobById({
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      status: "cancelled",
    });
    return true;
  }

  await runHostedRuntimeJobPipeline(row);
  return true;
}

/** Drain up to `maxJobs` from the queue (sequential). */
export async function runHostedRuntimeWorkerLoop(maxJobs: number): Promise<number> {
  let n = 0;
  for (let i = 0; i < maxJobs; i++) {
    const did = await runHostedRuntimeWorkerOnce();
    if (!did) break;
    n++;
  }
  return n;
}

/** Best-effort drain after async POST (do not await in the request handler). */
export function scheduleHostedRuntimeWorkerDrain(maxDrain = 8): void {
  queueMicrotask(() => {
    void runHostedRuntimeWorkerLoop(maxDrain).catch((err) => {
      console.error("[hosted-runtime-worker] drain failed:", err);
    });
  });
}
