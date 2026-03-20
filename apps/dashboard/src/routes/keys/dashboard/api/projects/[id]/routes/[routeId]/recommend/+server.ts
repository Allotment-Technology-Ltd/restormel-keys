import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProject, getProjectInWorkspace, getRouteWithSteps } from "$lib/server/db";

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

export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    const scope = await projectScope(locals, params.id);
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    const route = await getRouteWithSteps(params.routeId, scope.projectId, scope.userId);
    if (!route) return json({ error: "Not found" }, { status: 404 });

    const recommendations: Array<{ id: string; priority: "high" | "medium" | "low"; action: string }> = [];
    if (route.steps.length === 0) {
      recommendations.push({
        id: "add_steps",
        priority: "high",
        action: "Add at least one enabled step with provider/model preference.",
      });
    }
    if (route.steps.filter((s) => s.enabled).length === 0 && route.steps.length > 0) {
      recommendations.push({
        id: "enable_step",
        priority: "high",
        action: "Enable at least one route step.",
      });
    }
    const duplicateOrder = new Set<number>();
    const seen = new Set<number>();
    for (const step of route.steps) {
      if (seen.has(step.orderIndex)) duplicateOrder.add(step.orderIndex);
      seen.add(step.orderIndex);
    }
    if (duplicateOrder.size > 0) {
      recommendations.push({
        id: "normalize_order",
        priority: "medium",
        action: "Normalize route step order indexes to be unique and sequential.",
      });
    }

    return json({
      data: {
        routeId: route.route.id,
        diagnostics: {
          totalSteps: route.steps.length,
          enabledSteps: route.steps.filter((s) => s.enabled).length,
          duplicateOrderIndexes: [...duplicateOrder],
        },
        recommendations,
        diffPreview: recommendations.map((r) => ({ op: "recommend", code: r.id, action: r.action })),
        safeAutoApply: false,
      },
    });
  } catch (e) {
    console.error("[route.recommend] internal error:", e);
    return json({ error: "internal_error", detail: "route_recommend_failed" }, { status: 500 });
  }
};
