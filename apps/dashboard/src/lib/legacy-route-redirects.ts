/**
 * R2 — permanent (308) redirects for the north-star route migration.
 *
 * Source of truth: docs/design/keys-northstar-redesign-2026-06.md §2.3
 * (the disposition table). Every relocated dashboard URL maps old → new with
 * the full query string preserved (?step, ?filter, ?unit, ?workspace, ?focus,
 * returnTo, …). Redirects serve external/bookmark traffic only — the app's own
 * links point at the new canonical URLs.
 *
 * Pure module (no $lib/server imports) so the redirect table is unit-testable.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  AGENTS_HREF,
  ANSWER_CONSOLE_HREF,
  CLAIMS_HREF,
  CLAIMS_MEMORY_HREF,
  HOME_HREF,
  INGEST_FLOW_HREF,
  INGEST_ROUTES_HREF,
  PROVE_HREF,
  RUNS_HREF,
  SOURCES_HREF,
} from "$lib/nav-config";

const BASE = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE.slice(0, -1) : DASHBOARD_BASE;
const CONNECT = BASE + "/connect";

/** Append the original query string to a target that has none. */
function withSearch(target: string, search: string): string {
  if (!search || search === "?") return target;
  const q = search.startsWith("?") ? search.slice(1) : search;
  if (!q) return target;
  return target + (target.includes("?") ? "&" : "?") + q;
}

/**
 * Map a legacy dashboard pathname (+ query string) to its permanent home.
 * Returns null when the path is not a relocated URL (callers 404 / fall through).
 */
export function resolveLegacyDashboardRedirect(pathname: string, search = ""): string | null {
  const path = pathname !== BASE && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  // ── Default landing (Phase 3 Stage 1): the dashboard root opens on the verified
  // Answer Console (North Star = verified answers at query time). `/home` stays the
  // operator masthead, reachable from the work nav. `/activity` + `/connect` still
  // merge into `/home` (§2.3).
  if (path === BASE) return withSearch(ANSWER_CONSOLE_HREF, search);
  if (path === BASE + "/activity") return withSearch(HOME_HREF, search);
  if (path === CONNECT) return withSearch(HOME_HREF, search);

  // ── Connect hub sections → top-level sections ─────────────────────────
  if (path === CONNECT + "/library") return withSearch(SOURCES_HREF, search);

  // KILL (D8): the standalone job form duplicated the flow — its old redirect
  // target (wizard launch step) is preserved so any stray bookmark still lands well.
  if (path === CONNECT + "/ingest/new") return withSearch(INGEST_FLOW_HREF + "?step=launch", search);

  if (path === CONNECT + "/ingest") return withSearch(RUNS_HREF, search);
  if (path.startsWith(CONNECT + "/ingest/")) {
    return withSearch(RUNS_HREF + path.slice((CONNECT + "/ingest").length), search);
  }

  // Wizard → guided flow (`?step` preserved by the query-string carry).
  if (path === CONNECT + "/pipeline" || path.startsWith(CONNECT + "/pipeline/")) {
    return withSearch(INGEST_FLOW_HREF + path.slice((CONNECT + "/pipeline").length), search);
  }

  // Explorer (W2.1 URL contract: ?filter / ?unit / ?workspace / ?focus survive).
  if (path === CONNECT + "/graph") return withSearch(CLAIMS_HREF, search);

  if (path === CONNECT + "/memory") return withSearch(CLAIMS_MEMORY_HREF, search);

  if (path === CONNECT + "/proof" || path.startsWith(CONNECT + "/proof/")) {
    return withSearch(PROVE_HREF + path.slice((CONNECT + "/proof").length), search);
  }

  if (path === CONNECT + "/mcp") return withSearch(AGENTS_HREF, search);

  if (path === CONNECT + "/models") return withSearch(INGEST_ROUTES_HREF, search);

  // Anything else under the dissolved hub lands on Home (MERGE-INTO `/home`).
  if (path.startsWith(CONNECT + "/")) return withSearch(HOME_HREF, search);

  // ── KILL with redirect (§2.3): the usage stub linked to Analytics anyway ──
  const usageMatch = path.match(/^\/keys\/dashboard\/projects\/([^/]+)\/usage$/);
  if (usageMatch) {
    return withSearch(`${BASE}/analytics?project=${encodeURIComponent(usageMatch[1])}`, search);
  }

  return null;
}
