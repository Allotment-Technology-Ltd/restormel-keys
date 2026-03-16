/**
 * Explicit callback route so /api/auth/callback is always handled (Neon Auth verifier exchange).
 * Proxies to NEON_AUTH_BASE_URL/callback (or callback/github) with the request query string.
 * If Neon returns 404 we return 502 with a diagnostic so the 404 is distinguishable from the route not being hit.
 */
import { proxyAuthRequest } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

async function handleCallback(event: { request: Request; url: URL }, path: string) {
  const res = await proxyAuthRequest(path, event.request, event.url);
  return res;
}

export const GET: RequestHandler = async (event) => {
  let res = await handleCallback(event, "callback");
  if (res.status === 404) {
    res = await handleCallback(event, "callback/github");
  }
  if (res.status === 404) {
    return new Response(
      JSON.stringify({
        error: "Neon Auth callback returned 404",
        hint: "Check NEON_AUTH_BASE_URL in apps/dashboard/.env and that Auth is enabled in Neon Console. Tried paths: callback, callback/github.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return res;
};

export const POST: RequestHandler = async (event) => {
  let res = await handleCallback(event, "callback");
  if (res.status === 404) {
    res = await handleCallback(event, "callback/github");
  }
  if (res.status === 404) {
    return new Response(
      JSON.stringify({
        error: "Neon Auth callback returned 404",
        hint: "Check NEON_AUTH_BASE_URL in apps/dashboard/.env and that Auth is enabled in Neon Console. Tried paths: callback, callback/github.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return res;
};
