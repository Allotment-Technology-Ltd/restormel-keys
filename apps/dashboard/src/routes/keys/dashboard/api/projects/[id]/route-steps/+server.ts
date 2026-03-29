import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listRouteStepsByProject } from "$lib/server/db";

function projectScope(locals: App.Locals, projectId: string): { projectId: string; userId: string } | null {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key" && locals.user.projectIdForKey !== projectId) return null;
  return { projectId, userId: locals.user.uid };
}

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = projectScope(locals, params.id);
    if (!scope) return json({ error: "forbidden" }, { status: 403 });

    const steps = await listRouteStepsByProject(scope.projectId, scope.userId);
    const byRoute = Object.fromEntries(
      steps.reduce((acc, step) => {
        const list = acc.get(step.routeId) ?? [];
        list.push(step);
        acc.set(step.routeId, list);
        return acc;
      }, new Map<string, typeof steps>()).entries()
    );
    return json({ data: byRoute });
  } catch (e) {
    console.error("[project.route-steps.get] internal error:", e);
    return json({ error: "internal_error", detail: "project_route_steps_list_failed" }, { status: 500 });
  }
};
