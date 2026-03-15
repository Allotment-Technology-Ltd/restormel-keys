import type { PageServerLoad } from "./$types";
import { listProjects } from "$lib/server/firestore";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) return { projects: [] };
  const projects = await listProjects(locals.user.uid);
  return { projects };
};
