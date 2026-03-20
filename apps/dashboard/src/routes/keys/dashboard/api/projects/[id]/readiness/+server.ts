import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getProject,
  getProjectInWorkspace,
  listPolicies,
  listPolicyBindings,
  listProviderBindingsByProject,
  listRoutes,
  listRouteSteps,
} from "$lib/server/db";

type Severity = "low" | "medium" | "high";

async function projectScope(
  locals: App.Locals,
  projectId: string
): Promise<{ projectId: string; userId: string; workspaceId: string } | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key") {
    if (locals.user.projectIdForKey !== projectId) return null;
    const project = await getProject(projectId, locals.user.uid);
    return project?.workspaceId
      ? { projectId, userId: locals.user.uid, workspaceId: project.workspaceId }
      : null;
  }
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    const project = await getProjectInWorkspace(projectId, locals.user.workspaceId);
    return project ? { projectId, userId: project.userId, workspaceId: project.workspaceId ?? "" } : null;
  }
  const project = await getProject(projectId, locals.user.uid);
  return project?.workspaceId ? { projectId, userId: locals.user.uid, workspaceId: project.workspaceId } : null;
}

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const scope = await projectScope(locals, params.id);
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    const [bindings, routes, policies] = await Promise.all([
      listProviderBindingsByProject(scope.projectId),
      listRoutes(scope.projectId, scope.userId),
      listPolicies(scope.workspaceId),
    ]);
    const stepsPerRoute = await Promise.all(routes.map((r) => listRouteSteps(r.id, scope.projectId, scope.userId)));
    const issues: Array<{ severity: Severity; code: string; message: string; resource: string }> = [];
    const recommendations: Array<{ priority: Severity; action: string; reason: string }> = [];

    if (bindings.length === 0) {
      issues.push({
        severity: "high",
        code: "no_provider_bindings",
        message: "No provider bindings configured for this project.",
        resource: "provider_bindings",
      });
      recommendations.push({
        priority: "high",
        action: "Bind at least one verified provider integration to this project.",
        reason: "Runtime resolution requires reachable providers.",
      });
    }

    if (routes.length === 0) {
      issues.push({
        severity: "high",
        code: "no_routes",
        message: "No routes configured for this project.",
        resource: "routes",
      });
      recommendations.push({
        priority: "high",
        action: "Create at least one enabled route per active environment.",
        reason: "Resolve/simulate cannot select a route without route definitions.",
      });
    }

    let routesWithoutEnabledSteps = 0;
    for (const steps of stepsPerRoute) {
      if (!steps.some((s) => s.enabled)) routesWithoutEnabledSteps += 1;
    }
    if (routesWithoutEnabledSteps > 0) {
      issues.push({
        severity: "medium",
        code: "routes_without_enabled_steps",
        message: `${routesWithoutEnabledSteps} routes have no enabled steps.`,
        resource: "route_steps",
      });
      recommendations.push({
        priority: "medium",
        action: "Enable at least one step for each active route.",
        reason: "Routes with no enabled steps cannot resolve provider/model selections.",
      });
    }

    const projectPolicyBindings = await Promise.all(
      policies.map((p) => listPolicyBindings(p.id, scope.workspaceId).then((items) => ({ p, items })))
    );
    const activeProjectPolicies = projectPolicyBindings.filter((item) =>
      item.items.some((b) => b.targetType === "project" && b.targetId === scope.projectId)
    );
    if (activeProjectPolicies.length === 0) {
      issues.push({
        severity: "low",
        code: "no_project_policy_binding",
        message: "No policies are explicitly bound to this project.",
        resource: "policy_bindings",
      });
      recommendations.push({
        priority: "low",
        action: "Bind baseline policies (budget and model guardrails) to this project.",
        reason: "Bound policies improve predictable behavior and incident safety.",
      });
    }

    const status = issues.some((i) => i.severity === "high")
      ? "fail"
      : issues.some((i) => i.severity === "medium")
        ? "warn"
        : "ok";

    return json({
      data: {
        status,
        summary: {
          providerBindingCount: bindings.length,
          routeCount: routes.length,
          routeStepCount: stepsPerRoute.flat().length,
          projectPolicyBindingCount: activeProjectPolicies.length,
        },
        issues,
        recommendations,
      },
    });
  } catch (e) {
    console.error("[readiness] internal error:", e);
    return json({ error: "internal_error", detail: "readiness_failed" }, { status: 500 });
  }
};
