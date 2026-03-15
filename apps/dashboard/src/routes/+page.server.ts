import type { PageServerLoad } from "./$types";
import { listProjects } from "$lib/server/firestore";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) return { projects: [], projectsError: null };
  try {
    const projects = await listProjects(locals.user.uid);
    return { projects, projectsError: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[overview] listProjects failed:", msg.slice(0, 120));
    return { projects: [], projectsError: "Unable to load projects" };
  }
};
