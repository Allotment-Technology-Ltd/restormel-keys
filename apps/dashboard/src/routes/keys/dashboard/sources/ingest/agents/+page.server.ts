import { redirect } from "@sveltejs/kit";
import { AGENTS_HREF } from "$lib/nav-config";

/** Legacy pipeline path → Agents section. */
export const load = () => {
  throw redirect(302, AGENTS_HREF);
};
