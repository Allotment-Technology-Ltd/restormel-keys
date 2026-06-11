/**
 * Restart a failed or cancelled ingest job (creates a fresh queued job with the same inputs).
 */
import { json } from "@sveltejs/kit";
import { randomUUID } from "node:crypto";
import { buildInitialConnectIngestJob } from "@restormel/connect-core";
import {
  getConnectIngestJobForWorkspace,
  insertConnectIngestJob,
  connectIngestJobRecordToApi,
  appendConnectIngestJobLog,
  requeueReclaimedConnectIngestJob,
  CONNECT_INGEST_WORKER_LOST_ERROR,
} from "$lib/server/connect-ingest-jobs";
import { formatBracketLogLine } from "$lib/connect/bracket-log-timeline";
import { scheduleConnectIngestWorkerDrain } from "$lib/server/connect-ingest-worker";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const RESTARTABLE = new Set(["failed", "cancelled"]);

function isRestartablePreviewRun(existing: {
  status: string;
  progress: { execution_mode?: string } | null;
}): boolean {
  return existing.status === "completed" && existing.progress?.execution_mode === "stub";
}

function isRestartableFullRun(existing: {
  status: string;
  progress: { execution_mode?: string } | null;
}): boolean {
  return existing.status === "completed" && existing.progress?.execution_mode === "full";
}

export const POST: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const existing = await getConnectIngestJobForWorkspace({
    jobId: params.jobId,
    workspaceId: ctx.workspaceId,
  });
  if (!existing) {
    return json({ error: "not_found", message: "Ingest job not found." }, { status: 404 });
  }
  if (!RESTARTABLE.has(existing.status) && !isRestartablePreviewRun(existing) && !isRestartableFullRun(existing)) {
    return json(
      {
        error: "not_restartable",
        message: "Only failed, cancelled, or completed runs can be restarted.",
      },
      { status: 409 },
    );
  }
  if (!Array.isArray(existing.sources) || existing.sources.length === 0) {
    return json(
      { error: "no_sources", message: "This run has no sources to replay." },
      { status: 400 },
    );
  }

  // Stage 1.6: a run reclaimed after a stall (`worker_lost`) is re-queued IN PLACE,
  // preserving its stages + progress.resume checkpoint, so the worker resumes from
  // the last completed stage instead of re-spending finished LLM stages.
  if (
    existing.status === "failed" &&
    existing.error?.startsWith(CONNECT_INGEST_WORKER_LOST_ERROR)
  ) {
    const requeued = await requeueReclaimedConnectIngestJob({
      id: existing.id,
      workspaceId: ctx.workspaceId,
    });
    // Lost the requeue race (double-click / concurrent restart): the job is already
    // queued or running again — return it idempotently.
    const job =
      requeued ??
      (await getConnectIngestJobForWorkspace({
        jobId: existing.id,
        workspaceId: ctx.workspaceId,
      }));
    if (!job || (job.status !== "pending" && job.status !== "running")) {
      return json(
        { error: "not_restartable", message: "This run can no longer be re-queued." },
        { status: 409 },
      );
    }
    if (requeued) {
      const done = requeued.progress?.resume?.sources_done ?? 0;
      await appendConnectIngestJobLog({
        jobId: existing.id,
        line: formatBracketLogLine(
          "INGEST",
          done > 0
            ? `Re-queued after stall — resuming from checkpoint (${done} source(s) already complete)`
            : "Re-queued after stall — waiting for worker",
        ),
      });
    }
    scheduleConnectIngestWorkerDrain();
    return json(
      {
        restarted_from: existing.id,
        job: connectIngestJobRecordToApi(job, { includeSources: true }),
      },
      { status: 201 },
    );
  }

  const newId = randomUUID();
  const baseLabel = existing.label?.trim() || "Ingest run";
  const label = isRestartableFullRun(existing)
    ? baseLabel.replace(/ \(again\)$/i, "") + " (again)"
    : baseLabel.endsWith("(retry)")
      ? baseLabel
      : `${baseLabel} (retry)`;

  const job = buildInitialConnectIngestJob({
    id: newId,
    workspace_id: ctx.workspaceId,
    label,
    ...(existing.stopAfterStage
      ? { stop_after_stage: existing.stopAfterStage as import("@restormel/contracts/connect").ConnectIngestStage }
      : {}),
  });

  await insertConnectIngestJob({
    id: newId,
    workspaceId: ctx.workspaceId,
    projectId: existing.projectId,
    label,
    stages: job.stages ?? [],
    sources: existing.sources,
    stopAfterStage: existing.stopAfterStage,
    pipelineProfileId: existing.pipelineProfileId,
    domainPackId: existing.domainPackId,
    graphTargetId: existing.graphTargetId,
  });

  await appendConnectIngestJobLog({
    jobId: newId,
    line: formatBracketLogLine(
      "INGEST",
      `Restarted from run ${existing.id.slice(0, 8)}…`,
    ),
  });
  await appendConnectIngestJobLog({
    jobId: newId,
    line: formatBracketLogLine("INGEST", "Run queued — waiting for worker"),
  });

  scheduleConnectIngestWorkerDrain();

  const row = await getConnectIngestJobForWorkspace({
    jobId: newId,
    workspaceId: ctx.workspaceId,
  });

  return json(
    {
      restarted_from: existing.id,
      job: row ? connectIngestJobRecordToApi(row, { includeSources: true }) : null,
    },
    { status: 201 },
  );
};
