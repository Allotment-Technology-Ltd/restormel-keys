import type { PageServerLoad } from "./$types";
import { getProject, getProjectInWorkspace, getRouteWithSteps, getModelsLifecycleByIds } from "$lib/server/db";

async function projectScope(
  locals: App.Locals,
  projectId: string
): Promise<{ projectId: string; userId: string } | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key") {
    if (locals.user.projectIdForKey !== projectId) return null;
    return { projectId, userId: locals.user.uid };
  }
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    const project = await getProjectInWorkspace(projectId, locals.user.workspaceId);
    return project ? { projectId, userId: project.userId } : null;
  }
  const project = await getProject(projectId, locals.user.uid);
  return project ? { projectId, userId: locals.user.uid } : null;
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const scope = await projectScope(locals, params.id);
  if (!scope) {
    return {
      project: null,
      route: null,
      steps: [],
      modelLifecycleWarnings: [],
      error: "Not found",
    };
  }
  try {
    const result = await getRouteWithSteps(params.routeId, scope.projectId, scope.userId);
    if (!result) {
      return {
        project: null,
        route: null,
        steps: [],
        modelLifecycleWarnings: [],
        error: "Route not found",
      };
    }
    const modelIds: string[] = [];
    if (result.route.defaultModelId) modelIds.push(result.route.defaultModelId);
    for (const s of result.steps) {
      if (s.modelId) modelIds.push(s.modelId);
    }
    const lifecycleList = await getModelsLifecycleByIds(modelIds);
    const deprecatedStates = new Set(["deprecated", "retired"]);
    const modelLifecycleWarnings = lifecycleList.filter(
      (m) => m.lifecycleState && deprecatedStates.has(m.lifecycleState.toLowerCase())
    );
    const project = await getProject(scope.projectId, scope.userId);
    return {
      project: project ? { id: project.id, name: project.name } : null,
      route: result.route,
      steps: result.steps,
      modelLifecycleWarnings,
      error: null,
    };
  } catch (e) {
    console.error("[projects/[id]/routes/[routeId]] load failed:", e);
    return {
      project: null,
      route: null,
      steps: [],
      modelLifecycleWarnings: [],
      error: "Unable to load route",
    };
  }
};
