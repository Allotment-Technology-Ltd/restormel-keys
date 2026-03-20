import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  listEnvironments,
  listPolicies,
  listPolicyBindings,
  listProjectsByWorkspace,
  listRoutes,
} from "$lib/server/db";

export const load: PageServerLoad = async ({ locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) {
    return {
      policies: [],
      bindingsByPolicy: {},
      workspaceId: null as string | null,
      targets: { projects: [], environments: [], routes: [] },
      error: null as string | null,
    };
  }
  try {
    const policies = await listPolicies(ctx.workspaceId);
    const projects = await listProjectsByWorkspace(ctx.workspaceId);
    const projectsWithTargets = await Promise.all(
      projects.map(async (project) => {
        const [environments, routes] = await Promise.all([
          listEnvironments(project.id, project.userId),
          listRoutes(project.id, project.userId),
        ]);
        return { project, environments, routes };
      })
    );

    const bindingsByPolicy = Object.fromEntries(
      await Promise.all(
        policies.map(async (policy) => [policy.id, await listPolicyBindings(policy.id, ctx.workspaceId)])
      )
    );

    return {
      policies,
      bindingsByPolicy,
      workspaceId: ctx.workspaceId,
      targets: {
        projects: projectsWithTargets.map((p) => ({ id: p.project.id, name: p.project.name })),
        environments: projectsWithTargets.flatMap((p) =>
          p.environments.map((env) => ({
            id: env.id,
            name: env.name,
            type: env.type,
            projectId: p.project.id,
            projectName: p.project.name,
          }))
        ),
        routes: projectsWithTargets.flatMap((p) =>
          p.routes.map((route) => ({
            id: route.id,
            name: route.name,
            projectId: p.project.id,
            projectName: p.project.name,
            environmentId: route.environmentId,
          }))
        ),
      },
      error: null,
    };
  } catch (e) {
    console.error("[policies] load failed:", e);
    return {
      policies: [],
      bindingsByPolicy: {},
      workspaceId: null as string | null,
      targets: { projects: [], environments: [], routes: [] },
      error: "Unable to load policies",
    };
  }
};
