import type { RequestHandler } from "./$types";
import { base } from "$app/paths";
import { proxyAuthRequest, baseUrl } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url, request }) => {
  if (!baseUrl()) {
    throw redirect(302, base + "/?error=auth-not-configured");
  }

  const verifier = url.searchParams.get("neon_auth_session_verifier");
  if (!verifier) {
    throw redirect(302, base + "/?error=session-verifier-not-found");
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

  const target = `${url.origin}${base}/`;
  const response = new Response(null, {
    status: 302,
    headers: { Location: target },
  });
  for (const cookie of setCookies) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
};
