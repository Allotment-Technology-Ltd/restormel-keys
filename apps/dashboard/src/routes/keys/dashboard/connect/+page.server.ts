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

  // Per-request stats memo (F6): a single Map shared across all streamed load functions
  // in this request.  loadConnectGraphPulse and loadConnectTrustScorecardPanel both call
  // resolveConnectGraphStats; the memo ensures the second caller reuses the first
  // caller's in-flight Promise rather than issuing a redundant store scan.
  // The Map lives on event.locals so it is request-scoped and never bleeds across SSR
  // requests (no module-global state without TTL).
  if (!event.locals.connectStatsRequestMemo) {
    event.locals.connectStatsRequestMemo = new Map();
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
