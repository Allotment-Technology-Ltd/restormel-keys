import { keysDocsNavBlocksForFlags } from "$lib/keys/docs-nav";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { moduleDisabledRedirectPath } from "$lib/server/module-gates";
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const flags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
  const redirectPath = moduleDisabledRedirectPath(url.pathname, flags);
  if (redirectPath) {
    redirect(302, redirectPath);
  }

  return {
    moduleFlags: flags,
    keysDocsNavBlocks: keysDocsNavBlocksForFlags(flags),
  };
};
