/**
 * Neon Auth session or Bearer key (Gateway / Management). Populates event.locals.user.
 * Session: uid, email. Gateway key: uid = project owner, projectIdForKey, keyId. Management key: workspaceId, keyId.
 * Adds X-Session-Cookie for proxy when response sets cookie.
 */
import type { Handle } from "@sveltejs/kit";
import { json, redirect } from "@sveltejs/kit";
import { getSession } from "$lib/server/auth";
import { upsertUser } from "$lib/server/db";
import { getBearerToken } from "$lib/server/bearer";
import { verifyGatewayKey, verifyManagementKey } from "$lib/server/neon";
import { resolveServiceAdminStatus, syncServiceOwnerBootstrap } from "$lib/server/service-admin";
import { isFoundersCircleApproved, syncFoundersAccessForServiceOwner } from "$lib/server/founders-access";
import {
  isFoundersGateExemptPath,
  requiresFoundersCircleAccess,
} from "$lib/server/founders-access-gate";
import { resolveModuleFlags } from "$lib/server/module-flags";
import { moduleDisabledRedirectPath } from "$lib/server/module-gates";

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
    const { data: session, setCookies } = await getSession(event.request, event.url.host);
    authSessionCookies = setCookies;
    if (session?.user) {
      const email = session.user.email ?? null;
      const isServiceAdmin = await resolveServiceAdminStatus(
        session.user.id,
        session.user.role ?? null,
        email
      );
      const foundersStatus = await isFoundersCircleApproved(email);
      event.locals.user = {
        uid: session.user.id,
        email,
        name: session.user.name ?? null,
        authType: "session",
        isServiceAdmin,
        // null = lookup failed — do not treat as "not approved" (avoids spurious /founders/pending).
        foundersCircleApproved: isServiceAdmin || foundersStatus !== false,
      };
      try {
        await syncServiceOwnerBootstrap(session.user.id, email);
        await syncFoundersAccessForServiceOwner(email);
        await upsertUser(session.user.id, email);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg) console.error("[db] upsertUser:", msg.slice(0, 100));
      }
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
      if (!event.locals.user) event.locals.user = undefined;
    }
  } catch (e) {
    event.locals.user = undefined;
    const msg = e instanceof Error ? e.message : "";
    if (msg && !msg.includes("not configured")) console.error("[auth] getSession:", msg.slice(0, 100));
  }

  const pathname = event.url.pathname;
  const user = event.locals.user;

  const distinctId = user?.uid ?? event.cookies.get("ph_distinct_id") ?? "restormel-anonymous";
  event.locals.moduleFlags = await resolveModuleFlags(distinctId);

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

  const response = await resolve(event);

  /** Machine clients under the Gateway Key API tree should not receive HTML error pages. */
  if (
    event.url.pathname.startsWith("/keys/dashboard/api") ||
    event.url.pathname.startsWith("/keys/admin/api") ||
    event.url.pathname.startsWith("/keys/v1/") ||
    event.url.pathname.startsWith("/graph/v1/") ||
    event.url.pathname.startsWith("/connect/v1/") ||
    event.url.pathname.startsWith("/v1/")
  ) {
    const ct = response.headers.get("content-type") ?? "";
    if (response.status >= 400 && ct.includes("text/html")) {
      const status = response.status;
      const body =
        status === 404
          ? { error: "not_found", message: "No matching API route" }
          : { error: "internal_error", message: "Request failed" };
      return json(body, { status });
    }
  }

  if (authSessionCookies.length === 0) {
    const setCookie = response.headers.get("Set-Cookie");
    if (setCookie) {
      const headers = new Headers(response.headers);
      headers.set("X-Session-Cookie", setCookie);
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
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/** Deployment `config` belongs on `+layout.server.ts` / `+page.server.ts` / `+server.ts` (adapter-vercel), not here. */
