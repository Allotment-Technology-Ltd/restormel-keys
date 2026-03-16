import type { PageServerLoad } from "./$types";
import { listProjects } from "$lib/server/db";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) return { projects: [], error: null as string | null };
  try {
    const projects = await listProjects(locals.user.uid);
    return { projects, error: null };
  } catch (e) {
    console.error("[routes] load failed:", e);
    return { projects: [], error: "Unable to load projects" };
  }
};
