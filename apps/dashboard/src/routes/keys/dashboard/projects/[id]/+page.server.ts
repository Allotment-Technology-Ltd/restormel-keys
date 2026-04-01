import type { PageServerLoad } from "./$types";
import { getProject, listApiKeys, listEnvironments } from "$lib/server/db";

export const load: PageServerLoad = async ({ params, locals, url }) => {
  if (!locals.user)
    return { project: null, keys: [], environments: [], error: null, keysBaseUrl: url.origin };
  try {
    const project = await getProject(params.id, locals.user.uid);
    if (!project) return { project: null, keys: [], environments: [], error: null, keysBaseUrl: url.origin };
    const [keys, environments] = await Promise.all([
      listApiKeys(params.id, locals.user.uid),
      listEnvironments(params.id, locals.user.uid),
    ]);
    return { project, keys, environments, error: null, keysBaseUrl: url.origin };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[project] getProject/listApiKeys/listEnvironments failed:", msg.slice(0, 120));
    return { project: null, keys: [], environments: [], error: "Unable to load project", keysBaseUrl: url.origin };
  }
};
