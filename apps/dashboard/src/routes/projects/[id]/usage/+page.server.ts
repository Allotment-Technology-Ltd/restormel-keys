import type { PageServerLoad } from "./$types";
import { getProject } from "$lib/server/firestore";

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) return { project: null };
  const project = await getProject(params.id, locals.user.uid);
  return { project };
};
