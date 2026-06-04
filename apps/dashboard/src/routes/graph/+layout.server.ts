import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { isGraphPreview } from "$lib/server/module-flags";

export const load: LayoutServerLoad = async ({ locals }) => {
  const flags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
  if (flags.graph === "disabled") {
    throw redirect(302, "/keys?module-disabled=graph");
  }
  return {
    graphModulePreview: isGraphPreview(flags),
  };
};
