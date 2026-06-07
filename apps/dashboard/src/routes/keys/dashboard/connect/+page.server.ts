import type { PageServerLoad } from "./$types";
import { loadConnectHubPage, loadConnectGraphPulse } from "$lib/server/connect/connect-hub-load";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return {
      hub: Promise.resolve(null),
      graphPulse: Promise.resolve(null),
    };
  }
  return {
    // Fast path — renders the shell + ledger immediately from cached stats.
    hub: loadConnectHubPage(event),
    // Streamed — authoritative graph counts fill the pulse band when ready.
    graphPulse: loadConnectGraphPulse(event),
  };
};
