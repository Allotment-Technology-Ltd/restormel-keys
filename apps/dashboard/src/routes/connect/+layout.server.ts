import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const flags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
  if (!flags.connect) {
    throw redirect(302, "/keys?module-disabled=connect");
  }
  return {};
};
