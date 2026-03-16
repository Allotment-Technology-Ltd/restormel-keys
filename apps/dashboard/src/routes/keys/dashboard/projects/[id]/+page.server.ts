import type { PageServerLoad } from "./$types";
import { getProject, listApiKeys, listEnvironments } from "$lib/server/db";

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) return { project: null, keys: [], environments: [], error: null };
  try {
    const project = await getProject(params.id, locals.user.uid);
    if (!project) return { project: null, keys: [], environments: [], error: null };
    const [keys, environments] = await Promise.all([
      listApiKeys(params.id, locals.user.uid),
      listEnvironments(params.id, locals.user.uid),
    ]);
    return { project, keys, environments, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[project] getProject/listApiKeys/listEnvironments failed:", msg.slice(0, 120));
    return { project: null, keys: [], environments: [], error: "Unable to load project" };
  }
};
