import type { PageServerLoad } from "./$types";
import { loadConnectHubPage } from "$lib/server/connect/connect-hub-load";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return {
      hub: Promise.resolve(null),
    };
  }
  return {
    hub: loadConnectHubPage(event),
  };
};
