import type { PageServerLoad } from "./$types";
import { getProject, listApiKeys } from "$lib/server/db";

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) return { project: null, keys: [], error: null };
  try {
    const project = await getProject(params.id, locals.user.uid);
    if (!project) return { project: null, keys: [], error: null };
    const keys = await listApiKeys(params.id, locals.user.uid);
    return { project, keys, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[project] getProject/listApiKeys failed:", msg.slice(0, 120));
    return { project: null, keys: [], error: "Unable to load project" };
  }
};
