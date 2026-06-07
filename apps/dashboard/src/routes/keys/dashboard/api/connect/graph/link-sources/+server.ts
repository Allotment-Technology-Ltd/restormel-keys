/**
 * Queue automated source linking for graph ideas missing provenance.
 */
import { json } from "@sveltejs/kit";
import { randomUUID } from "node:crypto";
import { ConnectGraphLinkSourcesRequestSchema } from "@restormel/contracts/connect";
import { buildInitialConnectIngestJob } from "@restormel/connect-core";
import {
  appendConnectIngestJobLog,
  connectIngestJobRecordToApi,
  getConnectIngestJobForWorkspace,
  insertConnectIngestJob,
} from "$lib/server/connect-ingest-jobs";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import { resolveConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import { scheduleConnectIngestWorkerDrain } from "$lib/server/connect-ingest-worker";
import { formatBracketLogLine } from "$lib/connect/bracket-log-timeline";
import {
  buildGraphLinkSourcesJobSources,
  parseGraphLinkSourcesJobMeta,
} from "$lib/server/connect/graph-source-link-job";
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

    const parsed = ConnectGraphLinkSourcesRequestSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }

    const target = await getConnectGraphTargetForWorkspace(ctx.workspaceId);
    if (!target) {
      return json(
        { error: "graph_target_not_configured", message: "Connect a graph store before linking sources." },
        { status: 400 },
      );
    }

    const stats = await resolveConnectGraphStats(ctx.workspaceId);
    if (!stats || stats.units === 0) {
      return json(
        { error: "empty_graph", message: "Your graph has no ideas to link yet." },
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

    const domainPackId = parsed.data.domain_pack_id ?? null;
    const jobId = randomUUID();
    const label =
      parsed.data.label?.trim() ||
      `Link sources — ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

    const sources = buildGraphLinkSourcesJobSources({
      kind: "graph_link_sources",
      domain_pack_id: domainPackId,
      scope: parsed.data.scope,
      cohort_run_id: parsed.data.cohort_run_id ?? null,
    });
    if (!parseGraphLinkSourcesJobMeta(sources)) {
      return json({ error: "internal_error", message: "Could not build source-linking job." }, { status: 500 });
    }

    const job = buildInitialConnectIngestJob({
      id: jobId,
      workspace_id: ctx.workspaceId,
      label,
      stop_after_stage: "storing",
    });

    await insertConnectIngestJob({
      id: jobId,
      workspaceId: ctx.workspaceId,
      projectId,
      label,
      stages: job.stages ?? [],
      sources,
      stopAfterStage: "storing",
      domainPackId,
      graphTargetId: target.id ?? null,
    });

    await appendConnectIngestJobLog({
      jobId,
      line: formatBracketLogLine(
        "INGEST",
        `Source linking queued — scope: ${parsed.data.scope}`,
      ),
    });

    scheduleConnectIngestWorkerDrain();

    const row = await getConnectIngestJobForWorkspace({ jobId, workspaceId: ctx.workspaceId });
    return json({ job: row ? connectIngestJobRecordToApi(row) : null }, { status: 201 });
  } catch (e) {
    console.error("[connect/graph/link-sources] internal error:", e);
    return json(
      { error: "internal_error", message: "Could not queue source linking. Check server logs." },
      { status: 500 },
    );
  }
};
