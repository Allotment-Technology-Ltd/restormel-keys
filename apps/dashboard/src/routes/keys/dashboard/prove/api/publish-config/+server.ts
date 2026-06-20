/**
 * POST /keys/dashboard/prove/api/publish-config
 *
 * Phase 3 Stage 4 — "Publish = deploy the answer-serving config".
 *
 * Promotes the current verified-query routing config to LIVE: it publishes the
 * unpublished Connect ingestion routes that back the console answer (the chat
 * stages — extraction / grouping / validation / remediation), so the resolver
 * stops returning `route_unpublished` and the live endpoint
 * (`POST /connect/v1/graph`, operation `retrieve_context` — the one the Get-Code
 * snippet targets) serves this config to the user's app (MCP / AAIF / REST).
 *
 * This resolves the documented publish-stranding (K-P0-3) for the common case:
 * the user no longer has to hop into the 3,461-line route builder to flip each
 * route live. The advanced per-route publish path stays intact.
 *
 * Auth: session only (workspace-scoped) — reuses the same session-context guard as
 * the apply endpoint. Publishing reuses the shared `publishRouteInScope` helper, so
 * the validate→version-bump→audit path is identical to the per-route endpoint.
 * Each route is validated independently; one failing route does not silently flip
 * the others — we report per-route outcomes and surface a clear partial result.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  resolveKnowledgeRouteExecutionContext,
  listConnectStageRouteRows,
} from "$lib/server/connect/stage-routing";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import { publishRouteInScope } from "$lib/server/route-publish";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

/** Stages that feed the live answer pipeline (chat-shaped). Embedding is excluded. */
const CHAT_STAGES = new Set(["extraction", "grouping", "validation", "remediation"]);

type RoutePublishOutcome = {
  stage: string;
  routeId: string;
  status: "published" | "already_published" | "validation_failed" | "not_found";
  publishedVersion?: number;
  errors?: { field: string; message: string }[];
};

export const POST: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const exec = await resolveKnowledgeRouteExecutionContext({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
  });
  if (!exec) {
    return json(
      {
        error: "no_routing",
        message: "No model routing is configured yet — apply a model to a stage first.",
      },
      { status: 422 },
    );
  }

  const rows = await listConnectStageRouteRows({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    projectId: exec.projectId,
    environmentId: exec.environmentId,
    dashboardBase: DASHBOARD_BASE,
  });

  // The chat-stage routes that back the answer. De-dupe by routeId (stages can share
  // a route), so we never publish the same route twice in one request.
  const seen = new Set<string>();
  const targets: { stage: string; routeId: string; alreadyLive: boolean }[] = [];
  for (const row of rows) {
    if (!CHAT_STAGES.has(row.key) || !row.route) continue;
    if (seen.has(row.route.id)) continue;
    seen.add(row.route.id);
    targets.push({ stage: row.key, routeId: row.route.id, alreadyLive: row.route.isPublished });
  }

  if (targets.length === 0) {
    return json(
      {
        error: "no_routes",
        message: "No answer route is linked yet — apply a model to a stage before publishing.",
      },
      { status: 422 },
    );
  }

  const outcomes: RoutePublishOutcome[] = [];
  for (const t of targets) {
    if (t.alreadyLive) {
      outcomes.push({ stage: t.stage, routeId: t.routeId, status: "already_published" });
      continue;
    }
    const result = await publishRouteInScope({
      routeId: t.routeId,
      projectId: exec.projectId,
      userId: ctx.userId,
      actorId: ctx.userId,
      actorType: "console-publish",
    });
    if (result.ok) {
      outcomes.push({
        stage: t.stage,
        routeId: t.routeId,
        status: "published",
        publishedVersion: result.publishedVersion,
      });
    } else if (result.code === "publish_validation_failed") {
      outcomes.push({
        stage: t.stage,
        routeId: t.routeId,
        status: "validation_failed",
        errors: result.errors,
      });
    } else {
      outcomes.push({ stage: t.stage, routeId: t.routeId, status: "not_found" });
    }
  }

  const publishedCount = outcomes.filter((o) => o.status === "published").length;
  const failed = outcomes.filter(
    (o) => o.status === "validation_failed" || o.status === "not_found",
  );
  const live = failed.length === 0;

  return json({
    ok: failed.length === 0,
    live,
    publishedCount,
    alreadyLiveCount: outcomes.filter((o) => o.status === "already_published").length,
    failedCount: failed.length,
    projectId: exec.projectId,
    outcomes,
  });
};
