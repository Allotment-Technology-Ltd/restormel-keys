import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  listProviderIntegrations,
  listPolicies,
  listModels,
  listProjectsByWorkspace,
  listEnvironments,
  listRoutes,
  getRouteWithSteps,
} from "$lib/server/db";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";

type HealthStatus = "ok" | "warn" | "fail";

export const GET: RequestHandler = async ({ locals, url }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });

  const projectId = url.searchParams.get("projectId") ?? undefined;

  const [integrations, policies, models] = await Promise.all([
    listProviderIntegrations(ctx.workspaceId),
    listPolicies(ctx.workspaceId),
    listModels({ limit: 200 }),
  ]);

  const integrationsNeedingVerify = integrations.filter((i) => i.verificationStatus !== "verified");
  const latestModelVerify = models.reduce<number | null>((acc, m) => {
    if (m.sourceLastVerifiedAt == null) return acc;
    return acc == null ? m.sourceLastVerifiedAt : Math.max(acc, m.sourceLastVerifiedAt);
  }, null);

  const workspaceReport = {
    status: (integrations.length === 0 ? "warn" : "ok") as HealthStatus,
    integrations: {
      total: integrations.length,
      verified: integrations.filter((i) => i.verificationStatus === "verified").length,
      pending: integrations.filter((i) => i.verificationStatus === "pending").length,
      unverified: integrationsNeedingVerify.length,
    },
    policies: { total: policies.length },
    models: { total: models.length, latestSourceVerifiedAt: latestModelVerify },
  };

  const projects = await listProjectsByWorkspace(ctx.workspaceId);

  // Project-level checks require a user actor today (project ownership is user-scoped in DB helpers).
  if (!projectId || ctx.actorType !== "user") {
    return json({
      data: {
        scope: "workspace",
        workspaceId: ctx.workspaceId,
        actorType: ctx.actorType,
        workspace: workspaceReport,
        projects: projects.map((p) => ({ id: p.id, name: p.name })),
      },
    });
  }

  const envs = await listEnvironments(projectId, ctx.actorId);

  const envReports = await Promise.all(
    envs.map(async (env) => {
      const routes = await listRoutes(projectId, ctx.actorId, { environmentId: env.id });
      const activeRoutes = routes.filter((r) => r.status === "active");

      let routesWithNoEnabledStep = 0;
      for (const r of activeRoutes) {
        const withSteps = await getRouteWithSteps(r.id, projectId, ctx.actorId);
        if (!withSteps) continue;
        const enabled = withSteps.steps.filter((s) => s.enabled);
        if (enabled.length === 0) routesWithNoEnabledStep += 1;
      }

      const status: HealthStatus =
        activeRoutes.length === 0
          ? "fail"
          : routesWithNoEnabledStep > 0
            ? "warn"
            : "ok";

      return {
        id: env.id,
        name: env.name,
        type: env.type,
        status,
        routes: {
          total: routes.length,
          active: activeRoutes.length,
          activeWithNoEnabledStep: routesWithNoEnabledStep,
        },
      };
    })
  );

  const projectStatus: HealthStatus =
    envReports.some((e) => e.status === "fail")
      ? "fail"
      : envReports.some((e) => e.status === "warn")
        ? "warn"
        : "ok";

  return json({
    data: {
      scope: "workspace+project",
      workspaceId: ctx.workspaceId,
      actorType: ctx.actorType,
      workspace: workspaceReport,
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
      project: {
        id: projectId,
        status: projectStatus,
        environments: envReports,
      },
    },
  });
};

