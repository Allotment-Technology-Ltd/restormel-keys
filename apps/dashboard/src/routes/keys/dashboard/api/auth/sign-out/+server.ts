/**
 * Explicit sign-out route so /api/auth/sign-out is always handled (Neon Auth session clear).
 * Proxies to NEON_AUTH_BASE_URL/sign-out with the request query string.
 *
 * M2 SECURITY: also purge the server-side session cache entry for this cookie key, so a
 * captured cookie replayed at the same warm instance cannot be honored via the
 * last-known-good fallback in the resilience window after sign-out.
 */
import { proxyAuthRequest, purgeSessionCacheForRequest } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  purgeSessionCacheForRequest(event.request, event.url.host);
  return proxyAuthRequest("sign-out", event.request, event.url);
};

export const POST: RequestHandler = async (event) => {
  purgeSessionCacheForRequest(event.request, event.url.host);
  return proxyAuthRequest("sign-out", event.request, event.url);
};
