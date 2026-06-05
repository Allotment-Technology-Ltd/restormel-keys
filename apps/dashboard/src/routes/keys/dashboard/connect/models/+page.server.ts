import type { PageServerLoad } from "./$types";
import { loadConnectModelsPage } from "$lib/server/connect/connect-models-load";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return { models: null };
  }
  return { models: await loadConnectModelsPage(event) };
};
