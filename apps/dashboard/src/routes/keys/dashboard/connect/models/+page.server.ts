import type { PageServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  getOrCreateDefaultWorkspace,
  listEnvironments,
  listProjectsByWorkspace,
  listProviderIntegrations,
} from "$lib/server/db";
import {
  getConnectStageRouting,
  listConnectStageRouteRows,
} from "$lib/server/connect/stage-routing";
import { isLlmConfigured, knowledgeLlmModel } from "$lib/server/connect/llm-generate";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.authType !== "session") {
    return { models: null };
  }
  try {
    const workspace = await getOrCreateDefaultWorkspace(locals.user.uid);
    const userId = locals.user.uid;
    const [routing, integrations, projects] = await Promise.all([
      getConnectStageRouting(workspace.id),
      listProviderIntegrations(workspace.id).catch(() => []),
      listProjectsByWorkspace(workspace.id),
    ]);

    const projectId = routing?.project_id ?? projects[0]?.id ?? null;
    let environmentId = routing?.environment_id ?? null;
    const environments = projectId ? await listEnvironments(projectId, userId) : [];
    if (projectId && !environmentId) {
      environmentId = environments[0]?.id ?? null;
    }

    const stageRows =
      projectId && environmentId
        ? await listConnectStageRouteRows({
            workspaceId: workspace.id,
            userId,
            projectId,
            environmentId,
            dashboardBase: DASHBOARD_BASE,
          })
        : [];

    return {
      models: {
        routing,
        projects,
        projectId,
        environmentId,
        environments,
        stageRows,
        integrationsCount: integrations.length,
        llmReady: Boolean(routing?.project_id) || isLlmConfigured(),
        usesRoutes: Boolean(routing?.project_id),
        defaults: {
          chat: knowledgeLlmModel(),
          embedding: process.env.RESTORMEL_CONNECT_EMBED_MODEL?.trim() || "text-embedding-3-small",
        },
        apiBase: DASHBOARD_BASE + "/api/connect/pipeline/stage-models",
      },
    };
  } catch {
    return { models: null };
  }
};
