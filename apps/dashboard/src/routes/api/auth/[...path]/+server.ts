/**
 * Proxy to Neon Auth. All /api/auth/* requests are forwarded to NEON_AUTH_BASE_URL (query string included).
 */
import { proxyAuthRequest } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const path = event.params.path ?? "";
  return proxyAuthRequest(path, event.request, event.url);
};

export const POST: RequestHandler = async (event) => {
  const path = event.params.path ?? "";
  return proxyAuthRequest(path, event.request, event.url);
};
