import type { LayoutServerLoad } from "./$types";
import { loadConnectLayoutWorkspace } from "$lib/server/connect/workspace-cache";

/** Warm the workspace cache for this section's loads (was the Connect hub layout). */
export const load: LayoutServerLoad = async (event) => {
  return loadConnectLayoutWorkspace(event);
};
