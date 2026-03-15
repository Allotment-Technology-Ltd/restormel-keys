import type { PageServerLoad } from "./$types";
import { getProject } from "$lib/server/firestore";
import { listApiKeys } from "$lib/server/firestore";

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) return { project: null, keys: [] };
  const project = await getProject(params.id, locals.user.uid);
  if (!project) return { project: null, keys: [] };
  const keys = await listApiKeys(params.id, locals.user.uid);
  return { project, keys };
};
