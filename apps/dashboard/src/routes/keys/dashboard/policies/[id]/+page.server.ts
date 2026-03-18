import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  getPolicy,
  listPolicyBindings,
  listProjectsByWorkspace,
  listEnvironments,
  listModels,
  getWorkspace,
  listRoutes,
} from "$lib/server/db";

export const load: PageServerLoad = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return { policy: null, bindings: [], projects: [], models: [], workspaceId: null, error: "Unauthorized" };
  try {
    const policy = await getPolicy(params.id, ctx.workspaceId);
    if (!policy) return { policy: null, bindings: [], projects: [], models: [], workspaceId: null, error: "Not found" };
    const [bindingsRaw, projects, workspace] = await Promise.all([
      listPolicyBindings(params.id, ctx.workspaceId),
      listProjectsByWorkspace(ctx.workspaceId),
      getWorkspace(ctx.workspaceId),
    ]);
    const projectsWithEnvs = await Promise.all(
      projects.map(async (p) => ({
        id: p.id,
        name: p.name,
        userId: p.userId,
        environments: await listEnvironments(p.id, p.userId),
        routes: await listRoutes(p.id, p.userId),
      }))
    );
    const routeLabels = new Map<string, string>();
    for (const p of projectsWithEnvs) {
      for (const r of p.routes) routeLabels.set(r.id, `${r.name} (${p.name})`);
    }
    const workspaceName = workspace?.name ?? "This workspace";
    const projectById = new Map(projectsWithEnvs.map((p) => [p.id, p]));
    const envToLabel = new Map<string, string>();
    for (const p of projectsWithEnvs) {
      for (const env of p.environments) {
        envToLabel.set(env.id, `${env.name} (${p.name})`);
      }
    }
    const bindings = bindingsRaw.map((b) => {
      let label: string;
      if (b.targetType === "workspace") {
        label = b.targetId === ctx.workspaceId ? workspaceName : "Unknown (deleted?)";
      } else if (b.targetType === "project") {
        label = projectById.get(b.targetId)?.name ?? "Unknown (deleted?)";
      } else if (b.targetType === "environment") {
        label = envToLabel.get(b.targetId) ?? "Unknown (deleted?)";
      } else if (b.targetType === "route") {
        label = routeLabels.get(b.targetId) ?? "Unknown (deleted?)";
      } else {
        label = `${b.targetType}: ${b.targetId}`;
      }
      return { id: b.id, targetType: b.targetType, targetId: b.targetId, label };
    });
    const models = await listModels({ limit: 200 });
    return {
      policy,
      bindings,
      projects: projectsWithEnvs,
      models,
      workspaceId: ctx.workspaceId,
      workspaceName,
      error: null,
    };
  } catch (e) {
    console.error("[policies/[id]] load failed:", e);
    return { policy: null, bindings: [], projects: [], models: [], workspaceId: null, error: "Unable to load policy" };
  }
};
