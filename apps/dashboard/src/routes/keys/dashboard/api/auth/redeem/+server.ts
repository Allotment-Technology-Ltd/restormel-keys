import type { RequestHandler } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { proxyAuthRequest, baseUrl, authProvider } from "$lib/server/auth";
import { buildPostAuthLocation, consumeAuthReturnCookie } from "$lib/server/auth-return-cookie";
import { redirect } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url, request, cookies }) => {
  const authReturn = consumeAuthReturnCookie(cookies);

  // SELF path — there is no Neon `neon_auth_session_verifier`. Better Auth has
  // already set the session cookie on its own `/callback/github`; redeem just
  // consumes `rm_auth_return` and lands the user on the post-auth destination.
  if (authProvider() === "self") {
    const target = buildPostAuthLocation(url.origin, authReturn, `${DASHBOARD_BASE}/`);
    throw redirect(302, target);
  }

  if (!baseUrl()) {
    throw redirect(302, DASHBOARD_BASE + "/?error=auth-not-configured");
  }

  const verifier = url.searchParams.get("neon_auth_session_verifier");
  if (!verifier) {
    throw redirect(302, DASHBOARD_BASE + "/?error=session-verifier-not-found");
  }

  // Use proxyAuthRequest so all Set-Cookie headers are normalised (Domain stripped, Path=/)
  // proxyAuthRequest passes ourUrl.search to the target, so the verifier is forwarded automatically.
  const proxyRes = await proxyAuthRequest("get-session", request, url);

  console.log("[auth] redeem: get-session status", proxyRes.status);

  // If Neon returned a redirect (Location already rewritten to our dashboard root by
  // proxyAuthRequest), return it directly — it will carry the normalised Set-Cookie headers.
  if (proxyRes.status >= 300 && proxyRes.status < 400) {
    return proxyRes;
  }

  // Neon returned session JSON. Extract all normalised cookies and issue our own redirect.
  const setCookies =
    typeof (proxyRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie ===
    "function"
      ? (proxyRes.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : (() => {
          const single = proxyRes.headers.get("set-cookie");
          return single ? [single] : [];
        })();

  console.log("[auth] redeem: forwarding", setCookies.length, "cookie(s) to browser");

  const target = buildPostAuthLocation(url.origin, authReturn, `${DASHBOARD_BASE}/`);
  const response = new Response(null, {
    status: 302,
    headers: { Location: target },
  });
  for (const cookie of setCookies) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
};
