import type { PageServerLoad } from "./$types";
import { listProjects } from "$lib/server/db";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) return { projects: [], error: null };
  try {
    const projects = await listProjects(locals.user.uid);
    return { projects, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[copy-for-ci] listProjects failed:", msg.slice(0, 120));
    return { projects: [], error: "Unable to load projects" };
  }
};
