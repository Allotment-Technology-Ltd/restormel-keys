import type { PageServerLoad } from "./$types";
import { loadConnectModelsPage } from "$lib/server/connect/connect-models-load";
import { loadConnectSpine } from "$lib/server/connect/connect-hub-load";
import { isSignedInSession } from "$lib/server/session-user";

export const load: PageServerLoad = async (event) => {
  if (!isSignedInSession(event.locals)) {
    return { signedIn: false, models: null, spine: Promise.resolve(null) };
  }
  // Phase 2 spine — streamed so the route configurator renders without waiting.
  return { signedIn: true, models: await loadConnectModelsPage(event), spine: loadConnectSpine(event) };
};
