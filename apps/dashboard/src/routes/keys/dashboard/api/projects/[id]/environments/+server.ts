import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listEnvironments } from "$lib/server/db";
import { dashboardProjectScopeForApi } from "$lib/server/dashboard-project-api-scope";

/** GET: environments for a project (ids for RESTORMEL_ENVIRONMENT_ID in CI). Same auth as project keys API. */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const environments = await listEnvironments(scope.projectId, scope.userId);
  return json({ data: environments });
};
