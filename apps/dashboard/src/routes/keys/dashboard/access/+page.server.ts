import type { PageServerLoad } from "./$types";
import {
  listProjects,
  listApiKeys,
  getOrCreateDefaultWorkspace,
} from "$lib/server/db";

export type KeyWithProject = {
  id: string;
  keyPrefix: string;
  projectId: string;
  projectName: string;
};

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    return {
      signedIn: false,
      projects: [],
      keys: [] as KeyWithProject[],
      workspaceId: null as string | null,
      error: null as string | null,
      keysBaseUrl: url.origin,
    };
  }
  try {
    const projects = await listProjects(locals.user.uid);
    const keysByProject: KeyWithProject[] = [];
    for (const p of projects) {
      const keys = await listApiKeys(p.id, locals.user!.uid);
      for (const k of keys) {
        keysByProject.push({
          id: k.id,
          keyPrefix: k.keyPrefix,
          projectId: p.id,
          projectName: p.name,
        });
      }
    }
    const workspace = await getOrCreateDefaultWorkspace(locals.user.uid);
    return {
      signedIn: true,
      projects,
      keys: keysByProject,
      workspaceId: workspace.id,
      error: null,
      keysBaseUrl: url.origin,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[access] load failed:", msg.slice(0, 120));
    return {
      signedIn: true,
      projects: [],
      keys: [] as KeyWithProject[],
      workspaceId: null,
      error: "Unable to load access data",
      keysBaseUrl: url.origin,
    };
  }
};
