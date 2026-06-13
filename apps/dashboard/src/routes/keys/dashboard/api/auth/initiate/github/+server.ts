import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { setAuthReturnCookie } from "$lib/server/auth-return-cookie";
import { authProvider } from "$lib/server/auth";
import { env } from "$env/dynamic/private";

/** Collect all Set-Cookie values from a response (handles multi-value headers). */
function getSetCookies(headers: Headers): string[] {
  if (typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function") {
    return (headers as Headers & { getSetCookie: () => string[] }).getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

/** Strip Domain and normalise Path to / so cookies are scoped to our app's root. */
function normaliseCookie(cookie: string): string {
  return cookie
    .replace(/;\s*Domain=[^;]+/gi, "")
    .replace(/;\s*Path=[^;]+/gi, "; Path=/");
}

/**
 * SELF path — start GitHub sign-in via the in-process Better Auth `signInSocial`
 * API. Better Auth returns the GitHub authorization URL (+ any challenge cookie);
 * we 302 the browser there, forwarding the challenge cookie scoped to our root.
 * The OAuth `callbackURL` lands on Better Auth's own `/callback/github` (mounted
 * under the auth base path), which sets the session cookie, then redirects to our
 * `/api/auth/redeem` where we consume `rm_auth_return` and land the user.
 */
async function initiateSelfGithub(url: URL): Promise<Response> {
  const { getBetterAuth } = await import("$lib/server/better-auth");
  const auth = getBetterAuth();
  // After Better Auth completes the GitHub callback + sets the session cookie, send
  // the browser to our redeem route, which consumes rm_auth_return and lands them.
  const callbackURL = `${url.origin}${DASHBOARD_BASE}/api/auth/redeem`;
  try {
    const res = (await auth.api.signInSocial({
      body: {
        provider: "github",
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL: callbackURL,
      },
      asResponse: true,
    })) as Response;

    let redirectTo: string | null = null;
    const location = res.headers.get("Location");
    if (location && res.status >= 300 && res.status < 400) redirectTo = location;
    if (!redirectTo) {
      let data: unknown = null;
      try {
        data = await res.clone().json();
      } catch {
        /* ignore */
      }
      if (data && typeof data === "object" && "url" in data && typeof (data as any).url === "string") {
        redirectTo = (data as any).url;
      }
    }
    if (!redirectTo) {
      return json({ error: "Better Auth did not return a GitHub redirect URL" }, { status: 502 });
    }
    const response = new Response(null, { status: 302, headers: { Location: redirectTo } });
    for (const cookie of getSetCookies(res.headers)) {
      response.headers.append("Set-Cookie", normaliseCookie(cookie));
    }
    return response;
  } catch (e) {
    console.error("[auth] Better Auth signInSocial error", {
      error: e instanceof Error ? e.message : String(e),
      callbackURL,
    });
    return json({ error: "Failed to start GitHub sign-in (self)" }, { status: 502 });
  }
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  setAuthReturnCookie(cookies, {
    redirect: url.searchParams.get("redirect"),
    template: url.searchParams.get("template"),
  });
  if (authProvider() === "self") {
    return initiateSelfGithub(url);
  }
  const neonAuthBase = (env.NEON_AUTH_BASE_URL ?? "").replace(/\/$/, "");
  if (!neonAuthBase) {
    return json({ error: "Neon Auth not configured" }, { status: 503 });
  }

  const callbackURL = `${url.origin}${DASHBOARD_BASE}/api/auth/redeem`;

  let res: Response;
  try {
    res = await fetch(`${neonAuthBase}/sign-in/social`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: url.origin,
      },
      body: JSON.stringify({
        provider: "github",
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL: callbackURL,
      }),
      redirect: "manual",
    });
  } catch (e) {
    console.error("[auth] Neon Auth sign-in/social network error", {
      error: e instanceof Error ? e.message : String(e),
      endpoint: `${neonAuthBase}/sign-in/social`,
      callbackURL,
    });
    return json(
      {
        error: "Failed to reach Neon Auth for GitHub sign-in",
        upstreamStatus: null,
        upstreamMessage: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }

  // Determine where to send the browser (GitHub OAuth URL).
  let redirectTo: string | null = null;

  // Neon sometimes returns a 3xx with Location header.
  const location = res.headers.get("Location");
  if (location && res.status >= 300 && res.status < 400) {
    redirectTo = location;
  }

  // More commonly it returns 200 JSON: { url, redirect: true } or { data: { url } }.
  if (!redirectTo) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    if (data && typeof data === "object") {
      if ("url" in data && typeof (data as any).url === "string") {
        redirectTo = (data as any).url;
      } else if ("data" in data && (data as any).data?.url) {
        redirectTo = (data as any).data.url;
      }
    }

    if (!redirectTo) {
      // Surface the real Neon error so it's visible in the browser.
      let body = "";
      try {
        body = typeof data === "string" ? data : JSON.stringify(data);
      } catch { /* ignore */ }
      console.error("[auth] Neon Auth sign-in/social did not return a redirect URL", {
        status: res.status,
        body: body.slice(0, 400),
      });
      return new Response(body || "Neon Auth did not return a redirect URL", {
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") ?? "text/plain" },
      });
    }
  }

  // CRITICAL: Neon sets a session challenge cookie in the sign-in/social response.
  // We must forward it to the browser (scoped to our domain/root path) so that
  // when the browser returns to /api/auth/redeem, it sends the cookie back and
  // Neon can verify the challenge (SESSION_CHALLANGE_COOKIE_NOT_FOUND fix).
  const challengeCookies = getSetCookies(res.headers);
  console.log("[auth] initiate: forwarding", challengeCookies.length, "challenge cookie(s) to browser");

  const response = new Response(null, {
    status: 302,
    headers: { Location: redirectTo },
  });
  for (const cookie of challengeCookies) {
    response.headers.append("Set-Cookie", normaliseCookie(cookie));
  }
  return response;
};
