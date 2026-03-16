/**
 * Neon Auth client for browser. Points at app’s /api/auth proxy (same origin + base).
 */
import { createAuthClient } from "@neondatabase/neon-js/auth";
import { base } from "$app/paths";
import { browser } from "$app/environment";

const authUrl = browser ? `${window.location.origin}${base}/api/auth` : "";

export const authClient = createAuthClient(authUrl);
