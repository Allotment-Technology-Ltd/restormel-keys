import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { WORKSPACE_HOME_HREF } from "$lib/nav-config";

/** Dashboard root → workspace overview (scope-first landing). */
export const load: PageServerLoad = async () => {
  throw redirect(302, WORKSPACE_HOME_HREF);
};
