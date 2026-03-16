import type { PageServerLoad } from "./$types";
import {
  listProjects,
  listApiKeys,
  listProviderIntegrations,
  getOrCreateDefaultWorkspace,
} from "$lib/server/db";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return {
      projects: [],
      projectsError: null,
      onboarding: null,
    };
  }
  try {
    const [workspace, projects] = await Promise.all([
      getOrCreateDefaultWorkspace(locals.user.uid),
      listProjects(locals.user.uid),
    ]);
    let hasKeys = false;
    for (const p of projects) {
      const keys = await listApiKeys(p.id, locals.user!.uid);
      if (keys.length > 0) {
        hasKeys = true;
        break;
      }
    }
    const integrations = await listProviderIntegrations(workspace.id);
    const hasIntegrations = integrations.length > 0;
    return {
      projects,
      projectsError: null,
      onboarding: {
        hasProjects: projects.length > 0,
        hasKeys,
        hasIntegrations,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[overview] load failed:", msg.slice(0, 120));
    return {
      projects: [],
      projectsError: "Unable to load projects",
      onboarding: null,
    };
  }
};
