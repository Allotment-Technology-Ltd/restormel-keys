/**
 * Neon Auth client for browser. Points at app’s /api/auth proxy (same origin + base).
 */
import { createAuthClient } from "@neondatabase/neon-js/auth";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

// Use typeof window to check for browser environment instead of $app/environment
// to avoid SSR issues where $app/environment might not be available.
const browser = typeof window !== "undefined";

const authUrl = browser ? `${window.location.origin}${DASHBOARD_BASE}/api/auth` : "";

export const authClient = createAuthClient(authUrl);
