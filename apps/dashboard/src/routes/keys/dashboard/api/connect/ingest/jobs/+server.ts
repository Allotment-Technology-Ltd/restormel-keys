/**
 * Session-scoped Knowledge ingest jobs BFF (operator UI).
 * Workspace is resolved from the signed-in session — no UUIDs in the UI.
 */
import { json } from "@sveltejs/kit";
import { randomUUID } from "node:crypto";
import { ConnectIngestJobDashboardCreateSchema } from "@restormel/contracts/connect";
import { buildInitialConnectIngestJob } from "@restormel/connect-core";
import {
  insertConnectIngestJob,
  connectIngestJobRecordToApi,
  listConnectIngestJobsForWorkspace,
  getConnectIngestJobForWorkspace,
  appendConnectIngestJobLog,
  bulkCleanupIngestJobsForWorkspace,
} from "$lib/server/connect-ingest-jobs";
import { formatBracketLogLine } from "$lib/connect/bracket-log-timeline";
import { scheduleConnectIngestWorkerDrain } from "$lib/server/connect-ingest-worker";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import { expandDocumentsToSources } from "$lib/server/connect/source-documents";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const rows = await listConnectIngestJobsForWorkspace({ workspaceId: ctx.workspaceId });
  return json({ jobs: rows.map((row) => connectIngestJobRecordToApi(row)) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = ConnectIngestJobDashboardCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  // Validate optional project belongs to this workspace.
  let projectId: string | null = null;
  if (parsed.data.project_id) {
    const match = ctx.projects.find((p) => p.id === parsed.data.project_id);
    if (!match) {
      return json(
        { error: "invalid_project", message: "project_id is not in your workspace." },
        { status: 400 },
      );
    }
    projectId = match.id;
  }

  // Merge inline sources with expanded parsed documents.
  const inlineSources = parsed.data.sources ?? [];
  const docSources = parsed.data.document_ids?.length
    ? await expandDocumentsToSources(ctx.workspaceId, parsed.data.document_ids)
    : [];
  const allSources = [...inlineSources, ...docSources];
  if (allSources.length === 0) {
    return json(
      { error: "no_sources", message: "No usable sources or parsed documents were provided." },
      { status: 400 },
    );
  }

  const jobId = randomUUID();
  const job = buildInitialConnectIngestJob({
    id: jobId,
    workspace_id: ctx.workspaceId,
    label: parsed.data.label,
    stop_after_stage: parsed.data.stop_after_stage,
  });

  await insertConnectIngestJob({
    id: jobId,
    workspaceId: ctx.workspaceId,
    projectId,
    label: parsed.data.label ?? null,
    stages: job.stages ?? [],
    sources: allSources,
    stopAfterStage: parsed.data.stop_after_stage ?? null,
    pipelineProfileId: parsed.data.pipeline_profile_id ?? null,
    domainPackId: parsed.data.domain_pack_id ?? null,
    graphTargetId: parsed.data.graph_target_id ?? null,
  });

  await appendConnectIngestJobLog({
    jobId,
    line: formatBracketLogLine("INGEST", "Run queued — waiting for worker"),
  });

  scheduleConnectIngestWorkerDrain();

  const row = await getConnectIngestJobForWorkspace({ jobId, workspaceId: ctx.workspaceId });
  return json({ job: row ? connectIngestJobRecordToApi(row, { includeSources: true }) : null }, { status: 201 });
};

/**
 * Bulk cleanup: cancels all pending/running jobs, then hard-deletes jobs by status.
 * Body: { delete_statuses?: string[] } — defaults to ['cancelled','failed'].
 */
export const DELETE: RequestHandler = async ({ locals, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  let deleteStatuses: string[] = ["cancelled", "failed", "running"];
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body?.delete_statuses)) {
      deleteStatuses = (body.delete_statuses as unknown[])
        .filter((s): s is string => typeof s === "string")
        .filter((s) => ["pending", "running", "cancelled", "failed", "completed"].includes(s));
    }
  } catch {
    // use defaults
  }
  const result = await bulkCleanupIngestJobsForWorkspace({
    workspaceId: ctx.workspaceId,
    deleteStatuses,
  });
  return json({ cancelled: result.cancelled, deleted: result.deleted });
};
