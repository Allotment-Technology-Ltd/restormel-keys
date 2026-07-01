import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  resolveNavGroupsForModuleFlags,
  resolveWorkNavForModuleFlags,
  resolveTestingNavForModuleFlags,
  HOME_HREF,
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

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const moduleFlags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
  const baseWithSlash = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE : DASHBOARD_BASE + "/";
  const dashboardUiHiddenSet = parseDashboardUiHidden();
  for (const token of moduleFlagsToDashboardUiHidden(moduleFlags)) {
    dashboardUiHiddenSet.add(token as DashboardUiSection);
  }
  const dashboardUiHidden = [...dashboardUiHiddenSet];
  // RES-113 PR-G: nav is flag-resolved. With onboardingJourney OFF these helpers
  // return the north-star IA byte-for-byte; ON they return the Home·Build·Verify·
  // Connect verb spine. The dashboard-ui/monitor filter pass still applies on top.
  let navGroupsForUi = resolveNavGroupsForModuleFlags(moduleFlags);
  navGroupsForUi = filterNavGroupsForDashboardUi(navGroupsForUi, dashboardUiHiddenSet);
  const workNavForUi = resolveWorkNavForModuleFlags(moduleFlags);
  const testingNavForUi = resolveTestingNavForModuleFlags(moduleFlags);

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

  let journeySignals: { integrationCount: number; gatewayKeyCount: number } | null = null;
  let workspaceId: string | null = null;

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
      journeySignals = { integrationCount: integrations.length, gatewayKeyCount };
      endJourney();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown error";
      console.error("[dashboard layout] journey signals load failed:", msg.slice(0, 120));
    }
  }

  return {
    user: locals.user,
    authError,
    authDegraded: locals.authDegraded ?? false,
    projectContexts,
    workspaceId,
    journeySignals,
    dashboardUiHidden,
    navGroupsForUi,
    workNavForUi,
    testingNavForUi,
    moduleFlags,
    dashboardUiHiddenBanner,
    monitorInterestFromRedirect,
  };
};
