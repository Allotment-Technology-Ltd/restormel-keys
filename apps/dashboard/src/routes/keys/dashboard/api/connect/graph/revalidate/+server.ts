/**
 * Queue graph re-validation — updates validation_status on existing units via the ingest worker.
 */
import { json } from "@sveltejs/kit";
import { randomUUID } from "node:crypto";
import { ConnectGraphRevalidateRequestSchema } from "@restormel/contracts/connect";
import { buildInitialConnectIngestJob } from "@restormel/connect-core";
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
import { loadConnectGraphView } from "$lib/server/connect/graph-explorer-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, request }) => {
  try {
    if (typeof ConnectGraphRevalidateRequestSchema?.safeParse !== "function") {
      console.error(
        "[connect/graph/revalidate] ConnectGraphRevalidateRequestSchema missing — run pnpm -w --filter @restormel/contracts build",
      );
      return json(
        {
          error: "service_unavailable",
          message:
            "Re-validation API is out of date. Restart the dev server (pnpm --filter dashboard dev rebuilds contracts).",
        },
        { status: 503 },
      );
    }

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

    const parsed = ConnectGraphRevalidateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
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

    const graph = await loadConnectGraphView(ctx.workspaceId);
    if (!graph.stats || graph.stats.units === 0) {
      return json(
        { error: "empty_graph", message: "Your graph has no ideas to re-validate yet." },
        { status: 400 },
      );
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

    const domainPackId = parsed.data.domain_pack_id ?? graph.domainPackId ?? null;

    const jobId = randomUUID();
    const label =
      parsed.data.label?.trim() ||
      `Graph re-validation — ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

    const sources = buildGraphRevalidateJobSources({
      kind: "graph_revalidate",
      validation_route_id: parsed.data.validation_route_id ?? null,
      domain_pack_id: domainPackId,
      scope: parsed.data.scope,
    });
    if (!parseGraphRevalidateJobMeta(sources)) {
      return json({ error: "internal_error", message: "Could not build re-validation job." }, { status: 500 });
    }

    const job = buildInitialConnectIngestJob({
      id: jobId,
      workspace_id: ctx.workspaceId,
      label,
      stop_after_stage: "validating",
    });

    await insertConnectIngestJob({
      id: jobId,
      workspaceId: ctx.workspaceId,
      projectId,
      label,
      stages: job.stages ?? [],
      sources,
      stopAfterStage: "validating",
      domainPackId,
      graphTargetId: target.id ?? null,
    });

    await appendConnectIngestJobLog({
      jobId,
      line: formatBracketLogLine(
        "VALIDATE",
        `Re-validation queued — scope: ${parsed.data.scope}${parsed.data.validation_route_id ? ", custom validation route" : ""}`,
      ),
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
