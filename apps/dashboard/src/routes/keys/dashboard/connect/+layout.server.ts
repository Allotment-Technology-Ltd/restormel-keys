import type { LayoutServerLoad } from "./$types";
import { loadConnectLayoutWorkspace } from "$lib/server/connect/workspace-cache";

export const load: LayoutServerLoad = async (event) => {
  return loadConnectLayoutWorkspace(event);
};
