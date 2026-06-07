/**
 * Queue graph re-validation — updates validation_status on existing units via the ingest worker.
 */
import { json } from "@sveltejs/kit";
import { randomUUID } from "node:crypto";
import { buildInitialConnectIngestJob } from "@restormel/connect-core";
import { parseGraphRevalidateRequest } from "$lib/server/connect/graph-revalidate-request";
import {
  appendConnectIngestJobLog,
  connectIngestJobRecordToApi,
  getConnectIngestJobForWorkspace,
  insertConnectIngestJob,
} from "$lib/server/connect-ingest-jobs";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import { scheduleConnectIngestWorkerDrain } from "$lib/server/connect-ingest-worker";
import { formatBracketLogLine } from "$lib/connect/bracket-log-timeline";
import {
  buildGraphRevalidateJobSources,
  parseGraphRevalidateJobMeta,
} from "$lib/server/connect/graph-revalidate-job";
import { graphRevalidateEmptyMessage } from "$lib/server/connect/graph-revalidate-guards";
import { assertGraphReadyForAutoRemediation } from "$lib/server/connect/graph-readiness";
import { resolveConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, request }) => {
  try {
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

    const parsed = parseGraphRevalidateRequest(body);
    if (!parsed.success) {
      return json(
        { error: "invalid_request", message: parsed.error.issues.map((issue) => issue.message).join("; ") },
        { status: 400 },
      );
    }

    const target = await getConnectGraphTargetForWorkspace(ctx.workspaceId);
    if (!target) {
      return json(
        { error: "graph_target_not_configured", message: "Connect a graph store before re-validating." },
        { status: 400 },
      );
    }

    if (parsed.data.mode === "validate_and_remediate") {
      const readiness = await assertGraphReadyForAutoRemediation(ctx.workspaceId);
      if (!readiness.ok) {
        return json({ error: "graph_not_ready", message: readiness.message }, { status: 409 });
      }
    }

    const stats = await resolveConnectGraphStats(ctx.workspaceId);
    const emptyMessage = graphRevalidateEmptyMessage(stats, parsed.data.scope);
    if (emptyMessage) {
      return json({ error: "empty_graph", message: emptyMessage }, { status: 400 });
    }

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

    const domainPackId = parsed.data.domain_pack_id ?? null;

    const jobId = randomUUID();
    const dateLabel = new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const runsRemediation =
      parsed.data.mode === "validate_and_remediate" || parsed.data.mode === "remediate";
    const label =
      parsed.data.label?.trim() ||
      (parsed.data.mode === "remediate"
        ? `Graph remediation — ${dateLabel}`
        : parsed.data.mode === "validate_and_remediate"
          ? `Graph auto-remediation — ${dateLabel}`
          : `Graph re-validation — ${dateLabel}`);
    const stopAfterStage = runsRemediation ? "remediating" : "validating";

    const sources = buildGraphRevalidateJobSources({
      kind: "graph_revalidate",
      validation_route_id: parsed.data.validation_route_id ?? null,
      remediation_route_id: parsed.data.remediation_route_id ?? null,
      domain_pack_id: domainPackId,
      scope: parsed.data.scope,
      mode: parsed.data.mode,
      validation_mode: parsed.data.validation_mode,
      remediation_strictness: parsed.data.remediation_strictness,
      remediation_threshold: parsed.data.remediation_threshold ?? null,
      max_units: parsed.data.max_units ?? null,
      continue_in_background: parsed.data.continue_in_background ?? false,
      cohort_run_id: parsed.data.cohort_run_id ?? null,
    });
    if (!parseGraphRevalidateJobMeta(sources)) {
      return json({ error: "internal_error", message: "Could not build re-validation job." }, { status: 500 });
    }

    const job = buildInitialConnectIngestJob({
      id: jobId,
      workspace_id: ctx.workspaceId,
      label,
      stop_after_stage: stopAfterStage,
    });

    await insertConnectIngestJob({
      id: jobId,
      workspaceId: ctx.workspaceId,
      projectId,
      label,
      stages: job.stages ?? [],
      sources,
      stopAfterStage,
      domainPackId,
      graphTargetId: target.id ?? null,
    });

    const logParts = [
      parsed.data.mode === "remediate"
        ? "Remediation queued"
        : runsRemediation
          ? "Auto-remediation queued"
          : "Re-validation queued",
      `scope: ${parsed.data.scope}`,
      `mode: ${parsed.data.mode}`,
      ...(runsRemediation ? [`strictness: ${parsed.data.remediation_strictness}`] : []),
    ];
    if (parsed.data.validation_route_id) logParts.push("custom validation route");
    if (parsed.data.remediation_route_id) logParts.push("custom remediation route");
    if (stats?.validation.awaiting_triage != null) {
      logParts.push(`quarantine before: ${stats.validation.awaiting_triage}`);
    }

    await appendConnectIngestJobLog({
      jobId,
      line: formatBracketLogLine(runsRemediation ? "REMEDIATE" : "VALIDATE", logParts.join(" — ")),
    });

    scheduleConnectIngestWorkerDrain();

    const row = await getConnectIngestJobForWorkspace({ jobId, workspaceId: ctx.workspaceId });
    return json({ job: row ? connectIngestJobRecordToApi(row) : null }, { status: 201 });
  } catch (e) {
    console.error("[connect/graph/revalidate] internal error:", e);
    return json(
      { error: "internal_error", message: "Could not queue re-validation. Check server logs." },
      { status: 500 },
    );
  }
};
