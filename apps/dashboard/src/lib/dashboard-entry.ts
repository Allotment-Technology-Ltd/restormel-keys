/**
 * Marketing → dashboard entry URLs (Run Restormel, Sign in CTAs).
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { WORKSPACE_HOME_HREF } from "$lib/nav-config";

const DASH_NORM = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE.slice(0, -1) : DASHBOARD_BASE;

/** Sign-in route for unauthenticated users. */
export function dashboardLoginHref(): string {
  return `${DASH_NORM}/login`;
}

/** Primary CTA: workspace home when signed in, login otherwise. */
export function dashboardEntryHref(user: { uid: string } | null | undefined): string {
  return user?.uid ? WORKSPACE_HOME_HREF : dashboardLoginHref();
}

/**
 * Post-login redirect target from ?redirect= — same-origin dashboard paths only.
 */
export function safeDashboardRedirectPath(raw: string | null | undefined): string {
  if (!raw) return WORKSPACE_HOME_HREF;
  let path = raw.trim();
  if (!path.startsWith("/")) return WORKSPACE_HOME_HREF;
  if (path.startsWith("//")) return WORKSPACE_HOME_HREF;

  if (path === DASH_NORM || path.startsWith(`${DASH_NORM}/`)) {
    if (path === dashboardLoginHref() || path.startsWith(`${dashboardLoginHref()}/`)) {
      return WORKSPACE_HOME_HREF;
    }
    if (path.startsWith(`${DASH_NORM}/logout`)) return WORKSPACE_HOME_HREF;
    return path;
  }

  return WORKSPACE_HOME_HREF;
}
