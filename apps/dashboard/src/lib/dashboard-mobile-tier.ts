/**
 * Mobile read-only tier (Stage R6, §3.2 — absorbs W4.6's mobile half).
 *
 * The hard mobile gate OPENS for three read-only surfaces: Home (the masthead),
 * an individual run console (/runs/[id]), and Claims review. Everything else keeps
 * the gate with honest copy. Actions on the opened surfaces are hidden (not
 * disabled-and-teasing) via the `data-mobile-readonly` body flag the layout sets.
 *
 * Pure path matching so it's unit-testable and shared by the layout + any guard.
 */
import { HOME_HREF, RUNS_HREF, CLAIMS_HREF } from "$lib/nav-config";

/** True when `path` is a mobile-allowed surface (read-only tier). */
export function isMobileAllowedPath(path: string): boolean {
  if (path === HOME_HREF) return true;
  // Claims review desk (the list + its read-only detail), incl. sub-routes.
  if (path === CLAIMS_HREF || path.startsWith(CLAIMS_HREF + "/")) return true;
  // An *individual* run console: /runs/<id> — NOT the runs list (/runs) itself,
  // whose bulk actions aren't part of the read-only tier.
  if (path.startsWith(RUNS_HREF + "/")) return true;
  return false;
}
