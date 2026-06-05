import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { applyRecommendedIngestionRoutes } from "$lib/server/connect/apply-recommended-routes";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import { getConnectStageRouting } from "$lib/server/connect/stage-routing";
import { listEnvironments, listProviderIntegrations } from "$lib/server/db";

export const POST: RequestHandler = async ({ locals, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  let body: { project_id?: string; environment_id?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // optional body
  }

  const routing = await getConnectStageRouting(ctx.workspaceId);
  const projectId = body.project_id ?? routing?.project_id ?? ctx.projects[0]?.id;
  if (!projectId) {
    return json(
      { error: "no_project", message: "Create a Keys project and save project binding first." },
      { status: 400 },
    );
  }
  if (!ctx.projects.some((p) => p.id === projectId)) {
    return json({ error: "invalid_project", message: "Project not in this workspace." }, { status: 400 });
  }

  let environmentId = body.environment_id ?? routing?.environment_id ?? null;
  if (!environmentId) {
    const envs = await listEnvironments(projectId, ctx.userId);
    environmentId = envs[0]?.id ?? null;
  }
  if (!environmentId) {
    return json(
      { error: "no_environment", message: "Add an environment to the project first." },
      { status: 400 },
    );
  }

  const integrations = await listProviderIntegrations(ctx.workspaceId).catch(() => []);
  if (integrations.length === 0) {
    return json(
      {
        error: "no_providers",
        message: "Connect at least one AI provider under Integrations before applying recommended models.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyRecommendedIngestionRoutes({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      projectId,
      environmentId,
      actorType: locals.user?.authType ?? "session",
    });

    if (result.applied.length === 0) {
      return json(
        {
          error: "nothing_applied",
          message: "No routes were configured. Check provider connections and try again.",
          skipped: result.skipped,
        },
        { status: 422 },
      );
    }

    return json({
      ok: true,
      applied: result.applied,
      skipped: result.skipped,
      catalog_synced: result.catalogSynced,
      message: `Configured ${result.applied.length} ingestion route(s) with production models.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not apply recommended models.";
    console.error("[connect] apply-recommended-routes failed:", message.slice(0, 200));
    return json({ error: "apply_failed", message }, { status: 500 });
  }
};
