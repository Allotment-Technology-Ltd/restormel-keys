import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProject, getProjectInWorkspace, listRoutes, listRouteSteps } from "$lib/server/db";

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

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const scope = await projectScope(locals, params.id);
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    const routes = await listRoutes(scope.projectId, scope.userId);
    const stepsPerRoute = await Promise.all(routes.map((r) => listRouteSteps(r.id, scope.projectId, scope.userId)));
    const envCoverage = new Map<
      string,
      Map<string, { routeCount: number; enabledStepCount: number; hasEnabledRoute: boolean }>
    >();
    let zeroEnabledStepRoutes = 0;

    for (let i = 0; i < routes.length; i += 1) {
      const route = routes[i];
      const steps = stepsPerRoute[i] ?? [];
      const key = `${route.workload ?? "unspecified"}::${route.stage ?? "unspecified"}`;
      const envKey = route.environmentId;
      const enabledStepCount = steps.filter((s) => s.enabled).length;
      if (enabledStepCount === 0) zeroEnabledStepRoutes += 1;
      if (!envCoverage.has(envKey)) envCoverage.set(envKey, new Map());
      const current = envCoverage.get(envKey)?.get(key) ?? {
        routeCount: 0,
        enabledStepCount: 0,
        hasEnabledRoute: false,
      };
      current.routeCount += 1;
      current.enabledStepCount += enabledStepCount;
      current.hasEnabledRoute = current.hasEnabledRoute || ((route.enabled ?? true) && enabledStepCount > 0);
      envCoverage.get(envKey)?.set(key, current);
    }

    const environments = [...envCoverage.entries()].map(([environmentId, matrix]) => {
      const cells = [...matrix.entries()].map(([tuple, value]) => {
        const [workload, stage] = tuple.split("::");
        return { workload, stage, ...value };
      });
      const covered = cells.filter((c) => c.hasEnabledRoute).length;
      return {
        environmentId,
        coveredCells: covered,
        totalCells: cells.length,
        coveragePct: cells.length ? Number(((covered / cells.length) * 100).toFixed(2)) : 0,
        cells,
      };
    });

    return json({
      data: {
        routeCount: routes.length,
        zeroEnabledStepRoutes,
        environments,
      },
    });
  } catch (e) {
    console.error("[route.coverage] internal error:", e);
    return json({ error: "internal_error", detail: "route_coverage_failed" }, { status: 500 });
  }
};
