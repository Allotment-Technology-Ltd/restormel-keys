import type { PageServerLoad } from "./$types";
import {
  getOrCreateDefaultWorkspace,
  listEnvironments,
  listPolicies,
  listPolicyBindings,
  listProjects,
  listRequestLogs,
  listRoutes,
  listModels,
  listProviderModelVariants,
  listRouteSteps,
} from "$lib/server/db";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return {
      projects: [],
      routesByProject: {},
      routeRequestCount24h: {},
      policies: [],
      policyBindingsByPolicy: {},
      models: [],
      error: null as string | null,
    };
  }
  try {
    const userId = locals.user.uid;
    const workspace = await getOrCreateDefaultWorkspace(userId);
    const projects = await listProjects(userId);
    const now = Date.now();
    const since24h = now - 24 * 60 * 60 * 1000;

    const [projectDetails, policies, logs24h, modelRows] = await Promise.all([
      Promise.all(
        projects.map(async (project) => {
          const [environments, routes] = await Promise.all([
            listEnvironments(project.id, userId),
            listRoutes(project.id, userId),
          ]);
          const routeStepsByRoute = Object.fromEntries(
            await Promise.all(
              routes.map(async (route) => [route.id, await listRouteSteps(route.id, project.id, userId)])
            )
          );
          return { projectId: project.id, environments, routes, routeStepsByRoute };
        })
      ),
      listPolicies(workspace.id),
      listRequestLogs(workspace.id, { since: since24h, until: now, limit: 500 }),
      listModels({ limit: 250 }),
    ]);

    const policyBindingsByPolicy = Object.fromEntries(
      await Promise.all(
        policies.map(async (policy) => [policy.id, await listPolicyBindings(policy.id, workspace.id)])
      )
    );

    const modelVariantRows = await Promise.all(modelRows.map((model) => listProviderModelVariants(model.id)));
    const models = modelRows.map((model, idx) => {
      const variants = modelVariantRows[idx] ?? [];
      const availableProviderCount = variants.filter(
        (variant) => (variant.availabilityStatus ?? "").toLowerCase() === "available"
      ).length;
      return {
        id: model.id,
        name: model.canonicalName,
        provider: variants[0]?.providerIntegrationType ?? "unknown",
        contextWindow: model.contextWindow ?? null,
        speedBadge: "standard",
        availableProviderCount,
      };
    });

    const routeRequestCount24h: Record<string, number> = {};
    for (const log of logs24h) {
      if (!log.routeId) continue;
      routeRequestCount24h[log.routeId] = (routeRequestCount24h[log.routeId] ?? 0) + 1;
    }

    const routesByProject = Object.fromEntries(
      projectDetails.map((detail) => [
        detail.projectId,
        {
          environments: detail.environments,
          routes: detail.routes,
          routeStepsByRoute: detail.routeStepsByRoute,
        },
      ])
    );

    return {
      projects,
      routesByProject,
      routeRequestCount24h,
      policies,
      policyBindingsByPolicy,
      models,
      error: null,
    };
  } catch (e) {
    console.error("[routes] load failed:", e);
    return {
      projects: [],
      routesByProject: {},
      routeRequestCount24h: {},
      policies: [],
      policyBindingsByPolicy: {},
      models: [],
      error: "Unable to load routes",
    };
  }
};
