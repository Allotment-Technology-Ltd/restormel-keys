/**
 * Path helpers for Founders Circle dashboard gate (session users only).
 */
import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";

const DASH = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE.slice(0, -1) : DASHBOARD_BASE;
const ADMIN = ADMIN_BASE.endsWith("/") ? ADMIN_BASE.slice(0, -1) : ADMIN_BASE;

/** Routes a non-approved session may still reach while signed in. */
export function isFoundersGateExemptPath(pathname: string): boolean {
  if (pathname === "/founders/pending") return true;
  if (pathname === `${DASH}/login` || pathname.startsWith(`${DASH}/login/`)) return true;
  if (pathname === `${DASH}/logout` || pathname.startsWith(`${DASH}/logout/`)) return true;
  if (pathname.startsWith(`${DASH}/api/auth/`)) return true;
  return false;
}

/** Session-authenticated areas that require Founders Circle approval (or service operator). */
export function requiresFoundersCircleAccess(pathname: string): boolean {
  if (pathname.startsWith(`${ADMIN}/`) || pathname === ADMIN) return true;
  if (pathname.startsWith(`${DASH}/`) || pathname === DASH) return true;
  return false;
}
