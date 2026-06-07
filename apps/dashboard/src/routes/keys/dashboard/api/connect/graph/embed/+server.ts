/**
 * Queue embedding backfill for graph ideas missing vectors.
 */
import { json } from "@sveltejs/kit";
import { randomUUID } from "node:crypto";
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
  buildGraphEmbedBackfillJobSources,
  parseGraphEmbedBackfillJobMeta,
} from "$lib/server/connect/graph-embed-backfill-job";
import { parseGraphEmbedBackfillRequest } from "$lib/server/connect/graph-embed-backfill-request";
import { loadGraphEmbedBackfillOptions } from "$lib/server/connect/graph-embed-backfill-options";
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

    const parsed = parseGraphEmbedBackfillRequest(body);
    if (!parsed.success) {
      return json(
        { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }

    const target = await getConnectGraphTargetForWorkspace(ctx.workspaceId);
    if (!target) {
      return json(
        { error: "graph_target_not_configured", message: "Connect a graph store before embedding ideas." },
        { status: 400 },
      );
    }

    const options = await loadGraphEmbedBackfillOptions(ctx.workspaceId, ctx.userId);
    if (!options?.enabled || !options.health.actionNeeded || options.workCount === 0) {
      return json(
        {
          error: "nothing_to_embed",
          message:
            "All ideas already have uniform embedding vectors at the target dimension for this graph.",
        },
        { status: 400 },
      );
    }
    if (!options.embedReady) {
      return json(
        {
          error: "embedding_route_not_configured",
          message:
            "Publish an embedding ingestion route in AI models & keys before running embed backfill.",
        },
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
      `Embed missing ideas — ${new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;

    const scope =
      parsed.data.scope ??
      (options.recommendedScope === "uniform_target" ? "uniform_target" : "missing_only");
    const sources = buildGraphEmbedBackfillJobSources({
      kind: "graph_embed_backfill",
      embedding_route_id: parsed.data.embedding_route_id ?? null,
      domain_pack_id: domainPackId,
      scope,
      target_dimensions: options.health.targetDimensions,
    });
    if (!parseGraphEmbedBackfillJobMeta(sources)) {
      return json({ error: "internal_error", message: "Could not build embed backfill job." }, { status: 500 });
    }

    const job = buildInitialConnectIngestJob({
      id: jobId,
      workspace_id: ctx.workspaceId,
      label,
      stop_after_stage: "embedding",
    });

    await insertConnectIngestJob({
      id: jobId,
      workspaceId: ctx.workspaceId,
      projectId,
      label,
      stages: job.stages ?? [],
      sources,
      stopAfterStage: "embedding",
      domainPackId,
      graphTargetId: target.id ?? null,
    });

    const logParts = [
      "Embed backfill queued",
      scope === "uniform_target"
        ? `${options.workCount.toLocaleString()} idea(s) to uniform ${options.health.targetDimensions}d`
        : `${options.unembeddedCount.toLocaleString()} idea(s) missing vectors`,
    ];
    if (parsed.data.embedding_route_id) logParts.push("custom embedding route");

    await appendConnectIngestJobLog({
      jobId,
      line: formatBracketLogLine("EMBED", logParts.join(" — ")),
    });

    scheduleConnectIngestWorkerDrain();

    const row = await getConnectIngestJobForWorkspace({ jobId, workspaceId: ctx.workspaceId });
    return json({ job: row ? connectIngestJobRecordToApi(row) : null }, { status: 201 });
  } catch (e) {
    console.error("[connect/graph/embed] internal error:", e);
    return json(
      { error: "internal_error", message: "Could not queue embed backfill. Check server logs." },
      { status: 500 },
    );
  }
};
