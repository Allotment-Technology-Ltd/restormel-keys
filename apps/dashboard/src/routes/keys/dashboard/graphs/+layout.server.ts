import type { LayoutServerLoad } from "./$types";
import { loadConnectLayoutWorkspace } from "$lib/server/connect/workspace-cache";

/**
 * Warm the workspace cache for this section's loads so `requireConnectWorkspace`
 * in `+page.server.ts` resolves `connectWorkspace` from `event.parent()` (same
 * pattern as the sibling `sources/` section).
 */
export const load: LayoutServerLoad = async (event) => {
  return loadConnectLayoutWorkspace(event);
};
