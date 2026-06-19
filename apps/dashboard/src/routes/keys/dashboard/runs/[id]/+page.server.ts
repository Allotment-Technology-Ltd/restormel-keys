import type { PageServerLoad } from "./$types";
import { loadConnectSpine } from "$lib/server/connect/connect-hub-load";

/**
 * The run console renders entirely client-side from URL params; this load adds
 * only the Phase 2 spine (streamed) so the five-stage "where am I / what's next"
 * ledger is present on the run surface too. Never blocks the console.
 */
export const load: PageServerLoad = async (event) => {
  return { spine: loadConnectSpine(event) };
};
