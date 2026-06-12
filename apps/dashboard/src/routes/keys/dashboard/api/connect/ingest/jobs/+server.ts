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
  countConnectIngestJobsForWorkspace,
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
import { computeConnectRunPreflight } from "$lib/server/connect/run-preflight";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import { INGEST_FLOW_HREF } from "$lib/nav-config";
import { pageWithCursor } from "$lib/connect/ingest-runs-pagination";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
  const ctx = await resolveKnowledgeSessionContext(locals, { includeProjects: false });
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  // W3.1: cursor pagination + honest total. The data layer's keyset cursor
  // (neon.ts) was already there — the BFF just passes it through now (P1-4).
  // No params → default first page, identical to the pre-W3.1 shape plus the
  // two new fields (additive; the chip/poll fallback ignore them).
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw != null ? Math.min(Math.max(Number.parseInt(limitRaw, 10) || 20, 1), 100) : 20;
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const [rows, totalCount] = await Promise.all([
    listConnectIngestJobsForWorkspace({ workspaceId: ctx.workspaceId, limit, cursor }),
    countConnectIngestJobsForWorkspace({ workspaceId: ctx.workspaceId }),
  ]);

  // listConnectIngestJobsForWorkspace fetches limit+1 so the helper can detect the
  // next page and mint the keyset cursor (same contract as the /connect/v1 handler).
  const { page, nextCursor } = pageWithCursor(rows, limit);

  return json({
    jobs: page.map((row) => connectIngestJobRecordToApi(row)),
    next_cursor: nextCursor,
    total_count: totalCount,
  });
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

  // R4-S2: a full-mode run with no graph target dies mid-flight with
  // IngestConfigError("graph_target_not_configured") (see connect-ingest-worker).
  // Fail fast at submit so a doomed run is never created — same lookup the worker
  // performs. The launch panel's canStart gate already blocks this in the happy
  // path; this guard catches races (a store removed since page load) and any
  // direct BFF caller. Best-effort: a lookup failure does not block the run (the
  // worker re-checks and fails loudly if a store is genuinely absent).
  const graphTarget = await getConnectGraphTargetForWorkspace(ctx.workspaceId).catch(() => undefined);
  if (graphTarget === null) {
    return json(
      {
        error: "graph_target_not_configured",
        message:
          "No graph store is configured for this workspace. Connect a graph store before starting a run — the ingest would otherwise fail mid-flight.",
        fixHref: `${INGEST_FLOW_HREF}?step=store`,
      },
      { status: 422 },
    );
  }

  // K3 (K-P0-2): the same binding/credential lookup the worker performs mid-run,
  // enforced at submit time. Adds a gate — never bypasses existing validation above.
  // `legacy_env` runs execute on the environment key, so only `blocked` rejects here
  // (the UI gate already required the explicit legacy override before submitting).
  // Compute failures never brick launches: the run proceeds and fails loudly mid-run
  // exactly as before K3 if something is genuinely broken.
  const preflight = await computeConnectRunPreflight({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    projectId,
  }).catch(() => null);
  if (preflight?.status === "blocked") {
    return json(
      {
        error: "preflight_blocked",
        message:
          "Run preflight failed: a stage-route provider has no executable credential on the routing project. Fix the provider connection or binding, then start again.",
        preflight,
      },
      { status: 422 },
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
    preflight,
  });

  if (preflight) {
    await appendConnectIngestJobLog({
      jobId,
      line: formatBracketLogLine(
        "INGEST",
        preflight.status === "pass"
          ? `Preflight passed — ${preflight.providers.length} provider${preflight.providers.length === 1 ? "" : "s"} executable on the routing project`
          : "Preflight: no stage routes — running on the legacy environment key",
      ),
    });
  }

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
