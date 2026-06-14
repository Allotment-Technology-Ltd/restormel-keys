/**
 * Neon Auth session or Bearer key (Gateway / Management). Populates event.locals.user.
 * Session: uid, email. Gateway key: uid = project owner, projectIdForKey, keyId. Management key: workspaceId, keyId.
 * Adds X-Session-Cookie for proxy when response sets cookie.
 */
import { randomUUID } from "node:crypto";
import type { Handle, HandleServerError } from "@sveltejs/kit";
import { json, redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { agentLogServer } from "$lib/debug/agent-log.server";
import { perfSpan } from "$lib/debug/server-perf";
import { captureServerPostHogEvent } from "$lib/server/posthog-capture";
import { cookieHeaderMayCarrySession, getSession } from "$lib/server/auth";
import { getBearerToken } from "$lib/server/bearer";
import { verifyGatewayKey, verifyManagementKey } from "$lib/server/neon";
import { resolveSessionAuthContext } from "$lib/server/session-auth-cache";
import {
  isFoundersGateExemptPath,
  requiresFoundersCircleAccess,
} from "$lib/server/founders-access-gate";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { resolveModuleFlags } from "$lib/server/module-flags";
import { moduleDisabledRedirectPath } from "$lib/server/module-gates";

/** Dev-only once-per-process guard for the 127.0.0.1 cookie-split warning. */
let warned127CookieSplit = false;

/**
 * W4.6a dev aid: if the request is on `127.0.0.1` but carries no auth cookie, the
 * developer likely signed in on `localhost` (a different cookie origin). Point them at
 * the canonical host so the dashboard doesn't read as half-signed-in. No-op once warned.
 */
function warnOn127CookieSplit(host: string, cookieHeader: string): void {
  if (warned127CookieSplit) return;
  if (!host.startsWith("127.0.0.1")) return;
  if (cookieHeaderMayCarrySession(cookieHeader)) return;
  warned127CookieSplit = true;
  console.warn(
    `[auth][dev] Request on ${host} has no auth cookie. localhost and 127.0.0.1 are ` +
      `separate cookie origins — if you signed in on http://localhost:5173 you'll appear ` +
      `signed-out on 127.0.0.1 (and vice versa). Use ONE host (prefer http://localhost:5173/keys/dashboard).`,
  );
}

export const handle: Handle = async ({ event, resolve }) => {
  const legacyPath = event.url.pathname;
  if (legacyPath === "/knowledge" || legacyPath.startsWith("/knowledge/")) {
    throw redirect(308, legacyPath.replace(/^\/knowledge/, "/connect") + event.url.search);
  }
  if (legacyPath.startsWith("/keys/dashboard/knowledge")) {
    throw redirect(
      308,
      legacyPath.replace("/keys/dashboard/knowledge", "/keys/dashboard/connect") + event.url.search
    );
  }
  if (legacyPath.startsWith("/keys/dashboard/api/knowledge")) {
    throw redirect(
      308,
      legacyPath.replace("/keys/dashboard/api/knowledge", "/keys/dashboard/api/connect") +
        event.url.search
    );
  }
  if (legacyPath === "/docs/knowledge" || legacyPath.startsWith("/docs/knowledge/")) {
    throw redirect(308, legacyPath.replace(/^\/docs\/knowledge/, "/docs/connect") + event.url.search);
  }

  let authSessionCookies: string[] = [];
  try {
    const endSession = perfSpan("hooks", "getSession");
    const { data: session, setCookies, degraded } = await getSession(event.request, event.url.host);
    endSession();
    authSessionCookies = setCookies;
    // W4.6a: verification could not complete for a request that carried a session cookie
    // (Neon Auth 5xx / 429-with-no-cache / network throw). Do NOT treat as signed-out —
    // surface an auth-degraded flag so protected pages render an honest retry state
    // instead of the signed-out CTA, and so neighbouring requests don't flip to signed-out.
    event.locals.authDegraded = degraded === true && !session?.user;
    if (session?.user) {
      const email = session.user.email ?? null;
      // Memoized per (uid,email,role): admin/founders status (30s TTL) + once-per-process
      // bootstrap syncs. Previously up to 4 sequential Neon round-trips on EVERY request.
      const endAuthCtx = perfSpan("hooks", "resolveSessionAuthContext");
      const authCtx = await resolveSessionAuthContext({
        uid: session.user.id,
        email,
        role: session.user.role ?? null,
      });
      endAuthCtx();
      event.locals.user = {
        uid: session.user.id,
        email,
        name: session.user.name ?? null,
        authType: "session",
        isServiceAdmin: authCtx.isServiceAdmin,
        // null = lookup failed — do not treat as "not approved" (avoids spurious /founders/pending).
        foundersCircleApproved:
          authCtx.isServiceAdmin || authCtx.foundersCircleApproved !== false,
      };
    } else {
      const bearer = getBearerToken(event.request);
      if (bearer) {
        try {
          const gateway = await verifyGatewayKey(bearer);
          if (gateway) {
            event.locals.user = {
              uid: gateway.userId,
              email: null,
              authType: "gateway_key",
              projectIdForKey: gateway.projectId,
              keyId: gateway.keyId,
            };
          } else {
            const mgmt = await verifyManagementKey(bearer);
            if (mgmt) {
              event.locals.user = {
                uid: "",
                email: null,
                authType: "management_key",
                keyId: mgmt.keyId,
                workspaceId: mgmt.workspaceId,
              };
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg) console.error("[auth] Bearer verify:", msg.slice(0, 100));
        }
      }
      if (!event.locals.user) {
        event.locals.user = undefined;
      } else {
        // L3 SECURITY/CORRECTNESS: a valid Bearer key fully authenticated this request, so
        // the (cookie-based) session-verify being degraded is moot — clear the flag so a
        // bearer-authenticated request never carries a stale auth-degraded signal.
        event.locals.authDegraded = false;
      }
    }
  } catch (e) {
    event.locals.user = undefined;
    // W4.6a: if the request carried a session cookie, an unexpected throw in the auth
    // pipeline (resolveSessionAuthContext / bearer verify) is a verification FAILURE, not
    // a signed-out signal — flag it as degraded so protected pages don't silently demote.
    const cookieHeader = event.request.headers.get("cookie") ?? "";
    event.locals.authDegraded = cookieHeaderMayCarrySession(cookieHeader);
    const msg = e instanceof Error ? e.message : "";
    if (msg && !msg.includes("not configured")) console.error("[auth] getSession:", msg.slice(0, 100));
  }

  const pathname = event.url.pathname;
  const user = event.locals.user;

  // W4.6a (dev only): `localhost:5173` and `127.0.0.1:5173` are different cookie origins.
  // Signing in on one host and then visiting the other shows you signed-OUT there, which
  // reads as a "signed-in on some parts, not others" bug but is just a cookie-jar split.
  // Warn once so the developer reaches for the canonical host.
  if (dev) warnOn127CookieSplit(event.url.host, event.request.headers.get("cookie") ?? "");

  const distinctId = user?.uid ?? event.cookies.get("ph_distinct_id") ?? "restormel-anonymous";
  try {
    event.locals.moduleFlags = await resolveModuleFlags(distinctId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[module-flags] resolve failed:", msg.slice(0, 120));
    event.locals.moduleFlags = { ...MVP_MODULE_DEFAULTS };
  }

  const moduleRedirect = moduleDisabledRedirectPath(pathname, event.locals.moduleFlags);
  if (moduleRedirect && !pathname.startsWith("/keys/dashboard/api") && !pathname.startsWith("/v1/")) {
    throw redirect(302, `${event.url.origin}${moduleRedirect}`);
  }

  if (
    user?.authType === "session" &&
    !user.isServiceAdmin &&
    user.foundersCircleApproved === false &&
    requiresFoundersCircleAccess(pathname) &&
    !isFoundersGateExemptPath(pathname)
  ) {
    throw redirect(302, `${event.url.origin}/founders/pending`);
  }

  let response: Response;
  try {
    response = await resolve(event);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // #region agent log
    agentLogServer(
      "hooks.server.ts:resolve-throw",
      "resolve threw",
      { pathname, msg: msg.slice(0, 200) },
      "H4"
    );
    // #endregion
    throw e;
  }

  if (pathname === "/" || pathname === "") {
    // #region agent log
    agentLogServer(
      "hooks.server.ts:resolve-done",
      "GET / SSR completed",
      { status: response.status, contentType: response.headers.get("content-type")?.slice(0, 40) ?? null },
      "H4"
    );
    // #endregion
  }

  /** Machine clients under the Gateway Key API tree should not receive HTML error pages. */
  const isApiPath =
    event.url.pathname.startsWith("/keys/dashboard/api") ||
    event.url.pathname.startsWith("/keys/admin/api") ||
    event.url.pathname.startsWith("/keys/v1/") ||
    event.url.pathname.startsWith("/graph/v1/") ||
    event.url.pathname.startsWith("/connect/v1/") ||
    event.url.pathname.startsWith("/v1/");

  // X-Request-Id: echo from gateway or generate a fresh UUID for all Connect/Keys API paths.
  const requestId =
    event.request.headers.get("X-Request-Id") ??
    (isApiPath &&
    (event.url.pathname.startsWith("/connect/v1/") ||
      event.url.pathname.startsWith("/keys/v1/") ||
      event.url.pathname.startsWith("/graph/v1/"))
      ? randomUUID()
      : null);

  if (isApiPath) {
    const ct = response.headers.get("content-type") ?? "";
    if (response.status >= 400 && ct.includes("text/html")) {
      const status = response.status;
      const body: Record<string, unknown> =
        status === 404
          ? { error: "not_found", message: "No matching API route" }
          : { error: "internal_error", message: "Request failed" };
      if (requestId) body.request_id = requestId;
      return json(body, { status, headers: requestId ? { "X-Request-Id": requestId } : undefined });
    }
    // Inject request_id into existing JSON error bodies for Connect/Keys/Graph API paths.
    if (
      requestId &&
      response.status >= 400 &&
      ct.includes("application/json") &&
      (event.url.pathname.startsWith("/connect/v1/") ||
        event.url.pathname.startsWith("/keys/v1/") ||
        event.url.pathname.startsWith("/graph/v1/"))
    ) {
      try {
        const errBody = (await response.json()) as Record<string, unknown>;
        if (typeof errBody === "object" && errBody !== null && !("request_id" in errBody)) {
          errBody.request_id = requestId;
        }
        const headers = new Headers(response.headers);
        headers.set("X-Request-Id", requestId);
        return new Response(JSON.stringify(errBody), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch {
        // fall through if body cannot be parsed
      }
    }
  }

  if (authSessionCookies.length === 0) {
    const setCookie = response.headers.get("Set-Cookie");
    if (setCookie || requestId) {
      const headers = new Headers(response.headers);
      if (setCookie) headers.set("X-Session-Cookie", setCookie);
      if (requestId) headers.set("X-Request-Id", requestId);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return response;
  }

  const headers = new Headers(response.headers);
  for (const cookie of authSessionCookies) {
    headers.append("Set-Cookie", cookie);
  }
  const marker = response.headers.get("Set-Cookie") ?? authSessionCookies[0];
  if (marker) headers.set("X-Session-Cookie", marker);
  if (requestId) headers.set("X-Request-Id", requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/**
 * Redacted PostHog server-error capture.
 *
 * Capture contract (mirrors security-baseline.md redaction rules):
 *   ALLOWED:  error name, truncated message (no body echoes), pathname (no query),
 *             HTTP status, SvelteKit route ID.
 *   STRIPPED: error.stack (may contain file paths + data), event.url.search
 *             (query params may carry tokens), any property not listed above.
 *
 * Fire-and-forget; never blocks the error response. No-ops when POSTHOG_API_KEY is unset.
 */
function captureServerError(
  error: unknown,
  event: Parameters<HandleServerError>[0]["event"],
  status: number,
): void {
  const apiKey = process.env.POSTHOG_API_KEY ?? process.env.PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  const errorName = error instanceof Error ? error.name : "NonError";
  // Truncate message to 300 chars; never log stack (may echo request data).
  const errorMessage = (error instanceof Error ? error.message : String(error)).slice(0, 300);

  const distinctId =
    event.locals.user?.uid
      ? `uid_${event.locals.user.uid.slice(0, 12)}`
      : "server_anon";

  // Capture pathname only — never search/hash (may contain auth tokens or key IDs).
  const pathname = event.url.pathname.slice(0, 200);
  const routeId = event.route?.id ?? null;

  void captureServerPostHogEvent(distinctId, "server_error", {
    error_name: errorName.slice(0, 80),
    error_message: errorMessage,
    pathname,
    route_id: routeId ? String(routeId).slice(0, 120) : null,
    status,
    $lib: "restormel-hooks-server",
  });
}

export const handleError: HandleServerError = ({ error, event, status }) => {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[server-error]", event.url.pathname, status, msg);
  agentLogServer(
    "hooks.server.ts:handleError",
    "server error",
    {
      pathname: event.url.pathname,
      status,
      msg: msg.slice(0, 500),
      stack: stack?.slice(0, 4000),
    },
    "H4"
  );
  // PostHog exception capture (redacted — see captureServerError above).
  captureServerError(error, event, status);
  return { message: "Internal Error" };
};

/** Deployment `config` belongs on `+layout.server.ts` / `+page.server.ts` / `+server.ts` (adapter-vercel), not here. */
