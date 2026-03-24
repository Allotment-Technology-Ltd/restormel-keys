import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { NAV_GROUPS } from "$lib/nav-config";
import {
  dashboardUiSectionLabel,
  filterNavGroupsForDashboardUi,
  parseDashboardUiHidden,
  parseUiSectionHiddenParam,
  pathnameToHiddenDashboardSection,
} from "$lib/server/dashboard-ui-flags";
import { listEnvironments, listProjects } from "$lib/server/db";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const baseWithSlash = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE : DASHBOARD_BASE + "/";
  const dashboardUiHiddenSet = parseDashboardUiHidden();
  const dashboardUiHidden = [...dashboardUiHiddenSet];
  const navGroupsForUi = filterNavGroupsForDashboardUi(NAV_GROUPS, dashboardUiHiddenSet);

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
  const protectedPaths = ["/projects", "/healthcheck", "/billing", "/settings", "/sandbox"];
  const isProtected = protectedPaths.some((p) => pathAfterBase === p || pathAfterBase.startsWith(p + "/"));
  if (!locals.user && isProtected) {
    throw redirect(302, `${url.origin}${baseNorm}/login?redirect=${encodeURIComponent(pathname)}`);
  }

  // Hide advanced dashboard sections from UI (nav + direct navigation). APIs stay available.
  const gatedSection = pathnameToHiddenDashboardSection(pathname, dashboardUiHiddenSet);
  if (locals.user && gatedSection) {
    const target = new URL(`${baseNorm}/`, url.origin);
    target.searchParams.set("ui-section-hidden", gatedSection);
    throw redirect(302, target.toString());
  }

  const bannerSection = parseUiSectionHiddenParam(url.searchParams.get("ui-section-hidden"));
  const dashboardUiHiddenBanner = bannerSection
    ? { section: bannerSection, label: dashboardUiSectionLabel(bannerSection) }
    : null;

  let projectContexts: {
    id: string;
    name: string;
    environments: { id: string; name: string; type: string }[];
  }[] = [];

  if (locals.user) {
    try {
      const projects = await listProjects(locals.user.uid);
      projectContexts = await Promise.all(
        projects.map(async (project) => {
          const environments = await listEnvironments(project.id, locals.user!.uid);
          return {
            id: project.id,
            name: project.name,
            environments: environments.map((env) => ({ id: env.id, name: env.name, type: env.type })),
          };
        })
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown error";
      console.error("[dashboard layout] project context load failed:", msg.slice(0, 120));
    }
  }

  return {
    user: locals.user,
    authError,
    projectContexts,
    dashboardUiHidden,
    navGroupsForUi,
    dashboardUiHiddenBanner,
  };
};
