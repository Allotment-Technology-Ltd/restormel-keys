import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { base } from "$app/paths";
import { baseUrl } from "$lib/server/auth";

const NEON_AUTH_BASE_URL = baseUrl();

export const GET: RequestHandler = async ({ url, request }) => {
  if (!NEON_AUTH_BASE_URL) {
    throw redirect(302, base + "/?error=auth-not-configured");
  }

  const verifier = url.searchParams.get("neon_auth_session_verifier");
  if (!verifier) {
    throw redirect(302, base + "/?error=session-verifier-not-found");
  }

  const redeemUrl = new URL(`${NEON_AUTH_BASE_URL}/get-session`);
  redeemUrl.searchParams.set("neon_auth_session_verifier", verifier);

  const res = await fetch(redeemUrl.toString(), {
    method: "GET",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
      accept: "application/json",
      origin: url.origin,
    },
    redirect: "manual",
  });

  // Forward any cookies Neon sets (proxy layer in auth.ts will normalise Domain/Path)
  const headers = new Headers(res.headers);
  const setCookie = headers.get("set-cookie");

  // On success, just send the user to the dashboard root; hooks.server will pick up the session.
  const target = `${url.origin}${base}/`;
  const response = redirect(302, target);
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }
  return response;
};

