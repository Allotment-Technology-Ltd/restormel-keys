/**
 * Explicit sign-out route so /api/auth/sign-out is always handled (Neon Auth session clear).
 * Proxies to NEON_AUTH_BASE_URL/sign-out with the request query string.
 */
import { proxyAuthRequest } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  return proxyAuthRequest("sign-out", event.request, event.url);
};

export const POST: RequestHandler = async (event) => {
  return proxyAuthRequest("sign-out", event.request, event.url);
};
