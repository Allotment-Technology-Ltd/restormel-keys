/**
 * Neon Auth client for browser. Points at app’s /api/auth proxy (same origin + base).
 */
import { createAuthClient } from "@neondatabase/neon-js/auth";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { browser } from "$app/environment";

const authUrl = browser ? `${window.location.origin}${DASHBOARD_BASE}/api/auth` : "";

export const authClient = createAuthClient(authUrl);
