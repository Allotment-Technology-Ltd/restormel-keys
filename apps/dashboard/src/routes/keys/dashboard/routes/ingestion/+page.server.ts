import type { PageServerLoad } from "./$types";
import { loadConnectModelsPage } from "$lib/server/connect/connect-models-load";
import { isSignedInSession } from "$lib/server/session-user";

export const load: PageServerLoad = async (event) => {
  if (!isSignedInSession(event.locals)) {
    return { signedIn: false, models: null };
  }
  return { signedIn: true, models: await loadConnectModelsPage(event) };
};
