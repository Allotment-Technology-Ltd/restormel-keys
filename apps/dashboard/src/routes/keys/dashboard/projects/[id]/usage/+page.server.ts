import type { PageServerLoad } from "./$types";
import { getProject } from "$lib/server/db";

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) return { project: null, error: null };
  try {
    const project = await getProject(params.id, locals.user.uid);
    return { project, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[usage] getProject failed:", msg.slice(0, 120));
    return { project: null, error: "Unable to load project" };
  }
};
