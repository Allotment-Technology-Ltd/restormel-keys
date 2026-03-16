import type { PageServerLoad } from "./$types";
import { getProject, listEnvironments, listRoutes } from "$lib/server/db";

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) {
    return {
      project: null,
      environments: [],
      routes: [],
      error: "Unauthorized" as string | null,
    };
  }
  try {
    const project = await getProject(params.id, locals.user.uid);
    if (!project) {
      return {
        project: null,
        environments: [],
        routes: [],
        error: "Project not found",
      };
    }
    const [environments, routes] = await Promise.all([
      listEnvironments(params.id, locals.user.uid),
      listRoutes(params.id, locals.user.uid),
    ]);
    return {
      project: { id: project.id, name: project.name },
      environments,
      routes,
      error: null,
    };
  } catch (e) {
    console.error("[projects/[id]/routes] load failed:", e);
    return {
      project: null,
      environments: [],
      routes: [],
      error: "Unable to load routes",
    };
  }
};
