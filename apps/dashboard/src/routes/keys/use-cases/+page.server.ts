import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/**
 * Retired: Keys product-proof now lives on the consolidated /use-cases page
 * (templates + In-production proof). Permanently redirect, preserving deep-link
 * fragments (#plot-title, #sophia-title, #verified-context still resolve there).
 */
export const load: PageServerLoad = () => {
  throw redirect(308, "/use-cases");
};
