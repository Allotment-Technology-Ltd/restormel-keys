import type { PageServerLoad } from "./$types";
import { listProjects } from "$lib/server/db";

export const load: PageServerLoad = async ({ locals, url }) => {
  const initialUserCode = url.searchParams.get("user_code")?.trim() ?? "";
  if (!locals.user?.uid) {
    return { projects: [], initialUserCode };
  }
  const projects = await listProjects(locals.user.uid);
  return {
    projects,
    initialUserCode,
  };
};
