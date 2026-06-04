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
