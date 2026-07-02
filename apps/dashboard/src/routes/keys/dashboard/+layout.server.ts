import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  resolveNavGroupsForModuleFlags,
  resolveWorkNavForModuleFlags,
  resolveTestingNavForModuleFlags,
  resolveJourneyNav,
  HOME_HREF,
  type JourneyNav,
} from "$lib/nav-config";
import {
  dashboardUiSectionLabel,
  filterNavGroupsForDashboardUi,
  parseDashboardUiHidden,
  parseUiSectionHiddenParam,
  pathnameToHiddenDashboardSection,
} from "$lib/server/dashboard-ui-flags";
import { moduleFlagsToDashboardUiHidden } from "$lib/server/module-flags";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { dashboardSectionToMonitorInterest, parseMonitorInterestParam } from "$lib/dashboard-monitor-interest";
import type { DashboardUiSection } from "$lib/dashboard-ui-sections";
import { perfSpan } from "$lib/debug/server-perf";
import { getConnectWorkspaceCached } from "$lib/server/connect/workspace-cache";
import {
  countApiKeysByWorkspace,
  listProjectsWithEnvironments,
  listProviderIntegrations,
} from "$lib/server/db";
import { listSourceDocuments } from "$lib/server/connect/source-documents";
import { resolveConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import { listConnectIngestJobsForWorkspace } from "$lib/server/neon";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const moduleFlags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
  const baseWithSlash = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE : DASHBOARD_BASE + "/";
  const dashboardUiHiddenSet = parseDashboardUiHidden();
  for (const token of moduleFlagsToDashboardUiHidden(moduleFlags)) {
    dashboardUiHiddenSet.add(token as DashboardUiSection);
  }
  const dashboardUiHidden = [...dashboardUiHiddenSet];

  // Fix malformed redirect from Neon Auth: params appended as path (e.g. /keys/dashboard/state=...&error=...)
  const pathname = url.pathname;
  if (pathname.startsWith(baseWithSlash) && pathname.length > baseWithSlash.length) {
    const afterBase = pathname.slice(baseWithSlash.length);
    if (afterBase.includes("=") && !afterBase.startsWith("?")) {
      throw redirect(302, `${url.origin}${baseWithSlash}?${afterBase}`);
    }
  }

  // If we land on the dashboard with a verifier in the query, send it to the redeem endpoint.
  const verifier = url.searchParams.get("neon_auth_session_verifier");
  if (verifier) {
    const redeemUrl = new URL(`${url.origin}${DASHBOARD_BASE}/api/auth/redeem`);
    redeemUrl.searchParams.set("neon_auth_session_verifier", verifier);
    throw redirect(302, redeemUrl.toString());
  }

  const authError = url.searchParams.get("error") ?? null;

  // Redirect unauthenticated users from protected routes to login (Overview shows welcome instead).
  const baseNorm = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE.slice(0, -1) : DASHBOARD_BASE;
  const pathAfterBase = pathname.slice(pathname.indexOf(baseNorm) + baseNorm.length) || "/";
  const protectedPaths = [
    "/projects",
    "/healthcheck",
    "/billing",
    "/settings",
    "/sandbox",
    "/cli",
    "/admin",
  ];
  const isProtected = protectedPaths.some((p) => pathAfterBase === p || pathAfterBase.startsWith(p + "/"));
  // W4.6a: do NOT bounce a cookie-bearing request to login when auth verification merely
  // errored (`authDegraded`) — that would silently sign the user out on an infra blip.
  // The shell + page render the auth-degraded retry state instead; only a genuinely
  // signed-out request (no user, not degraded) is redirected to login.
  if (!locals.user && !locals.authDegraded && isProtected) {
    throw redirect(302, `${url.origin}${baseNorm}/login?redirect=${encodeURIComponent(pathname)}`);
  }

  // Hide advanced dashboard sections from UI (nav + direct navigation). APIs stay available.
  const gatedSection = pathnameToHiddenDashboardSection(pathname, dashboardUiHiddenSet);
  if (locals.user && gatedSection) {
    const monitorItem =
      !moduleFlags.monitor ? dashboardSectionToMonitorInterest(gatedSection) : null;
    if (monitorItem) {
      const target = new URL(HOME_HREF, url.origin);
      target.searchParams.set("monitor-interest", monitorItem);
      throw redirect(302, target.toString());
    }
    const target = new URL(`${baseNorm}/`, url.origin);
    target.searchParams.set("ui-section-hidden", gatedSection);
    throw redirect(302, target.toString());
  }

  const monitorInterestFromRedirect = parseMonitorInterestParam(url.searchParams.get("monitor-interest"));

  const bannerSection = parseUiSectionHiddenParam(url.searchParams.get("ui-section-hidden"));
  const dashboardUiHiddenBanner = bannerSection
    ? { section: bannerSection, label: dashboardUiSectionLabel(bannerSection) }
    : null;

  type ProjectContextRow = {
    id: string;
    name: string;
    environments: { id: string; name: string; type: string }[];
  };

  // The six work sections stream project nav data (was: the Connect hub).
  const workSectionPrefixes = ["/home", "/sources", "/runs", "/claims", "/prove", "/agents"];
  const isConnectRoute = workSectionPrefixes.some(
    (prefix) => pathAfterBase === prefix || pathAfterBase.startsWith(prefix + "/"),
  );

  let projectContexts: ProjectContextRow[] | Promise<ProjectContextRow[]> = [];

  // RES-113 PR-2 (plan §3.5): `journeySignals` is extended with the four counts
  // `resolveJourneyNav` needs (sourceCount, completedRunCount, flaggedClaimCount,
  // connectionCount) and its computation is HOISTED above nav resolution (§3.5 found
  // an ordering bug — signals were computed AFTER nav resolution). The four extra
  // counts are computed ONLY on the flag-ON branch, so the flag-OFF path issues the
  // exact same queries (integrations + gateway keys) and returns the exact same
  // `journeySignals` shape as before — byte-identical. PR-4 wires these into
  // `resolveJourneyNav`; PR-2 only makes them available in the right order.
  type JourneySignals = {
    integrationCount: number;
    gatewayKeyCount: number;
    /** Flag-ON only (null on the flag-OFF path — inert). */
    sourceCount: number | null;
    completedRunCount: number | null;
    flaggedClaimCount: number | null;
    connectionCount: number | null;
  };
  let journeySignals: JourneySignals | null = null;
  let workspaceId: string | null = null;
  // RES-113 PR-4: the resolved state-derived journey nav (plan §3.5 AFTER-state).
  // Non-null ONLY on the flag-ON path with a signed-in user AND healthy signals;
  // the flag-OFF payload gains an inert `journeyNav: null` field (same pattern as
  // the PR-2 null journey counts). When signals fail, this stays null and the
  // shell falls back to the static journey items — degraded, never wrong.
  let journeyNav: JourneyNav | null = null;

  if (locals.user) {
    const loadProjectContexts = async (): Promise<ProjectContextRow[]> => {
      try {
        const endProjects = perfSpan("dashboard/layout", "listProjectsWithEnvironments");
        const rows = await listProjectsWithEnvironments(locals.user!.uid);
        endProjects();
        return rows;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "unknown error";
        console.error("[dashboard layout] project context load failed:", msg.slice(0, 120));
        return [];
      }
    };

    if (isConnectRoute) {
      // Stream project nav data — don't block Connect SSR on a slow Neon round-trip.
      projectContexts = loadProjectContexts();
    } else {
      projectContexts = await loadProjectContexts();
    }

    try {
      const endJourney = perfSpan("dashboard/layout", "journeySignals");
      const workspace = await getConnectWorkspaceCached(locals.user.uid);
      workspaceId = workspace.id;
      const [integrations, gatewayKeyCount] = await Promise.all([
        listProviderIntegrations(workspace.id),
        countApiKeysByWorkspace(workspace.id),
      ]);

      // The four journey-nav counts are flag-ON only: the flag-OFF path never issues
      // these queries, so its `journeySignals` payload is unchanged (the extra fields
      // stay null). Failures here degrade to null without failing the whole load.
      let sourceCount: number | null = null;
      let completedRunCount: number | null = null;
      let flaggedClaimCount: number | null = null;
      let connectionCount: number | null = null;
      if (moduleFlags.onboardingJourney) {
        const endExtra = perfSpan("dashboard/layout", "journeySignals.journeyCounts");
        const [documents, jobs, stats] = await Promise.all([
          listSourceDocuments(workspace.id).catch(() => []),
          listConnectIngestJobsForWorkspace({ workspaceId: workspace.id }).catch(() => []),
          resolveConnectGraphStats(workspace.id).catch(() => null),
        ]);
        sourceCount = documents.length;
        // "Completed" = a SUCCESSFULLY finished run only. `!== pending/running` would
        // also count `failed`/`cancelled` (the worker sets `failed`; `neon.ts`
        // reclaims stalled runs as `failed`) — a workspace whose only run failed would
        // then read as having a graph. The S2 "ingest complete" gate needs a real
        // success, so this is `status === "completed"` exactly.
        completedRunCount = jobs.filter((j) => j.status === "completed").length;
        // M4 "app connections" are GATEWAY KEYS (the ConnectionsManager builds its
        // rows from `setup.gatewayKeys`), NOT the ingest *source* connectors that
        // `listConnections` returns (those feed the Sources setup step). Reuse the
        // already-fetched `gatewayKeyCount` — no extra query, and the LIVE-vs-
        // BUILT_NOT_CONNECTED distinction keys on the right signal.
        connectionCount = gatewayKeyCount;
        flaggedClaimCount = stats
          ? stats.validation.awaiting_triage ?? stats.validation.weak + stats.validation.unsupported
          : 0;

        // ── PR-4: resolve the state-derived journey nav (plan §3.5) ────────────
        // `units > 0` is the shared "graph exists" gate (same as deriveHomeState —
        // the nav and Home can never disagree about EMPTY vs built).
        const units = stats ? stats.units : 0;
        // The MONOTONIC Verify anchor (founder §4.4), SERVER-derived: weak /
        // unsupported validation statuses persist after triage (the operator
        // verdict is recorded in the validation note, not by clearing the status),
        // so once a claim has ever been flagged this stays true and the Verify tab
        // cannot flicker out as the awaiting-triage count returns to zero. If a
        // history is ever fully re-validated to `ok`, the signal degrades to the
        // forward-only trigger (`flaggedClaimCount > 0`) — the tab is then merely
        // not monotonic in that edge, never wrongly shown (PR-2's documented
        // degraded case).
        const everHadVerifyActivity = stats
          ? stats.validation.weak + stats.validation.unsupported > 0 || flaggedClaimCount > 0
          : false;
        // The switcher gate needs the real project count; on the flag-ON branch we
        // await the (possibly streamed) project rows. Flag-OFF streaming behaviour
        // is untouched, and a failed load already degraded to [] → switcher hidden.
        const projectRows = await projectContexts;
        journeyNav = resolveJourneyNav(
          {
            completedRunCount,
            units,
            connectionCount,
            flaggedClaimCount,
            everHadVerifyActivity,
            projectCount: projectRows.length,
          },
          moduleFlags,
        );
        endExtra();
      }

      journeySignals = {
        integrationCount: integrations.length,
        gatewayKeyCount,
        sourceCount,
        completedRunCount,
        flaggedClaimCount,
        connectionCount,
      };
      endJourney();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown error";
      console.error("[dashboard layout] journey signals load failed:", msg.slice(0, 120));
    }
  }

  // RES-113 PR-G: nav is flag-resolved. With onboardingJourney OFF these helpers
  // return the north-star IA byte-for-byte; ON they return the Home·Build·Verify·
  // Connect verb spine. The dashboard-ui/monitor filter pass still applies on top.
  // HOISTED to AFTER journeySignals (plan §3.5 ordering fix) — the resolvers still
  // read only `moduleFlags` today, so moving them past the signal computation is
  // inert for both flag paths; PR-4 will thread the hoisted signals into
  // `resolveJourneyNav` here.
  let navGroupsForUi = resolveNavGroupsForModuleFlags(moduleFlags);
  navGroupsForUi = filterNavGroupsForDashboardUi(navGroupsForUi, dashboardUiHiddenSet);
  const workNavForUi = resolveWorkNavForModuleFlags(moduleFlags);
  const testingNavForUi = resolveTestingNavForModuleFlags(moduleFlags);

  return {
    user: locals.user,
    authError,
    authDegraded: locals.authDegraded ?? false,
    projectContexts,
    workspaceId,
    journeySignals,
    journeyNav,
    dashboardUiHidden,
    navGroupsForUi,
    workNavForUi,
    testingNavForUi,
    moduleFlags,
    dashboardUiHiddenBanner,
    monitorInterestFromRedirect,
  };
};
