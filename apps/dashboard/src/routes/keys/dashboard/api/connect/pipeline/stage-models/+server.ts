/**
 * Per-stage Keys route routing for Knowledge ingestion (session-scoped).
 */
import { json } from "@sveltejs/kit";
import { ConnectStageRoutingSchema } from "@restormel/contracts/connect";
import { upsertConnectStageRoutingConfig } from "$lib/server/neon";
import { listEnvironments, listProjectsByWorkspace } from "$lib/server/db";
import {
  getConnectStageRouting,
  listConnectStageRouteRows,
} from "$lib/server/connect/stage-routing";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const routing = await getConnectStageRouting(ctx.workspaceId);
  const projects = ctx.projects;
  const projectId = routing?.project_id ?? projects[0]?.id ?? null;
  let environmentId = routing?.environment_id ?? null;
  if (projectId && !environmentId) {
    const envs = await listEnvironments(projectId, ctx.userId);
    environmentId = envs[0]?.id ?? null;
  }

  const stageRows =
    projectId && environmentId
      ? await listConnectStageRouteRows({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          projectId,
          environmentId,
          dashboardBase: DASHBOARD_BASE,
        })
      : [];

  return json({
    routing,
    projects,
    projectId,
    environmentId,
    stageRows,
  });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
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
  const parsed = ConnectStageRoutingSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const project = ctx.projects.find((p) => p.id === parsed.data.project_id);
  if (!project) {
    return json({ error: "invalid_project", message: "Project must belong to this workspace." }, { status: 400 });
  }

  if (parsed.data.environment_id) {
    const envs = await listEnvironments(parsed.data.project_id, ctx.userId);
    if (!envs.some((e) => e.id === parsed.data.environment_id)) {
      return json({ error: "invalid_environment", message: "Environment not found for project." }, { status: 400 });
    }
  }

  await upsertConnectStageRoutingConfig(ctx.workspaceId, parsed.data);
  return json({ routing: parsed.data });
};
