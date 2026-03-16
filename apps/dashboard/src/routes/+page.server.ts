import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** Server redirect for marketing home so crawlers get a 302. */
export const load: PageServerLoad = async () => {
  throw redirect(302, "/keys");
};
