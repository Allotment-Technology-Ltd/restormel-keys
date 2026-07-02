import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import {
  loadConnectHubPage,
  loadConnectTrustScorecardPanel,
  type ConnectHubPayload,
} from "$lib/server/connect/connect-hub-load";
import { isSignedInSession } from "$lib/server/session-user";
import type { ConnectTrustScorecard } from "@restormel/contracts";

/**
 * RES-113 PR-6b — `/verify` (M2) becomes a real page (plan §3.3: net-new scope —
 * this was a bare 308 alias to `/claims` since PR-G).
 *
 * Flag-ON: streams the SAME hub payload + trust scorecard Home already loads
 * (no new queries — Stage 1.8 invariant); the page derives its surface from
 * `resolveM2Surface` over the hub spine, so `/verify` and the Home tiles can
 * never disagree about whether verify work is outstanding.
 *
 * Flag-OFF: the route still does not exist (404) — byte-for-byte the pre-PR-6
 * response, preserving the REC-ADR-021 byte-identity invariant. (The redirect
 * this rewrites was itself flag-ON-only; flag-OFF has 404'd since PR-G.)
 */
export const load: PageServerLoad = (event) => {
  const moduleFlags = event.locals?.moduleFlags ?? MVP_MODULE_DEFAULTS;
  if (!moduleFlags.onboardingJourney) throw error(404);

  if (!isSignedInSession(event.locals)) {
    return {
      hubSignedIn: false,
      hub: Promise.resolve(null) as Promise<ConnectHubPayload | null>,
      scorecard: Promise.resolve(null) as Promise<ConnectTrustScorecard | null>,
    };
  }

  // Per-request stats memo (F6): the hub + scorecard loads share one stats scan.
  if (!event.locals.connectStatsRequestMemo) {
    event.locals.connectStatsRequestMemo = new Map();
  }

  return {
    hubSignedIn: true,
    hub: loadConnectHubPage(event),
    scorecard: loadConnectTrustScorecardPanel(event),
  };
};
