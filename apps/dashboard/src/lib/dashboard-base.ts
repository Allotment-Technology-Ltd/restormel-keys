/**
 * Base path for the dashboard when served at /keys/dashboard (single-app setup).
 * Use this instead of $app/paths.base in dashboard routes and components.
 */
export const DASHBOARD_BASE = "/keys/dashboard";

/**
 * Service-owner admin console (separate from the end-user dashboard shell).
 * Session + `isServiceAdmin` only; no consumer sidebar.
 */
export const ADMIN_BASE = "/keys/admin";
