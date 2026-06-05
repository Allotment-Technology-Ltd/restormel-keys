import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getRoute } from "$lib/server/db";
import { dashboardProjectScopeForApi } from "$lib/server/dashboard-project-api-scope";
import { resolvePrimaryStepModel } from "$lib/server/connect/resolve-stage-route-models";

/** GET: primary enabled model step for a route (ingest routes active config). */
export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await dashboardProjectScopeForApi(locals, params.id);
    if (!scope) return json({ error: "forbidden" }, { status: 403 });

    const route = await getRoute(params.routeId, scope.projectId, scope.userId);
    if (!route) return json({ error: "route_not_found" }, { status: 404 });

    const resolved = await resolvePrimaryStepModel({
      routeId: params.routeId,
      projectId: scope.projectId,
      userId: scope.userId,
    });

    return json({ data: resolved });
  } catch (e) {
    console.error("[route.primary-model.get] internal error:", e);
    return json({ error: "internal_error", detail: "route_primary_model_failed" }, { status: 500 });
  }
};
