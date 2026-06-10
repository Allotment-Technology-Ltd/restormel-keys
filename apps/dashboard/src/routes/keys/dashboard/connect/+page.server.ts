import type { PageServerLoad } from "./$types";
import {
  loadConnectHubPage,
  loadConnectGraphPulse,
  loadConnectTrustScorecardPanel,
  loadConnectQualityHistoryPanel,
} from "$lib/server/connect/connect-hub-load";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return {
      hub: Promise.resolve(null),
      graphPulse: Promise.resolve(null),
      scorecard: Promise.resolve(null),
      qualityHistory: Promise.resolve([]),
    };
  }
  return {
    // Fast path — renders the shell + ledger immediately from cached stats.
    hub: loadConnectHubPage(event),
    // Streamed — authoritative graph counts fill the pulse band when ready.
    graphPulse: loadConnectGraphPulse(event),
    // Streamed — per-graph trust scorecard panel (Stage 1.2).
    scorecard: loadConnectTrustScorecardPanel(event),
    // Streamed — quality-history timeline (Stage 2.4).
    qualityHistory: loadConnectQualityHistoryPanel(event),
  };
};
