/**
 * Neon Auth session or Bearer key (Gateway / Management). Populates event.locals.user.
 * Session: uid, email. Gateway key: uid = project owner, projectIdForKey, keyId. Management key: workspaceId, keyId.
 * Adds X-Session-Cookie for proxy when response sets cookie.
 */
import type { Handle } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { getSession } from "$lib/server/auth";
import { upsertUser } from "$lib/server/db";
import { getBearerToken } from "$lib/server/bearer";
import { verifyGatewayKey, verifyManagementKey } from "$lib/server/neon";
import { resolveServiceAdminStatus } from "$lib/server/service-admin";

export const handle: Handle = async ({ event, resolve }) => {
  try {
    const { data: session } = await getSession(event.request, event.url.host);
    if (session?.user) {
      const isServiceAdmin = await resolveServiceAdminStatus(
        session.user.id,
        session.user.role ?? null
      );
      event.locals.user = {
        uid: session.user.id,
        email: session.user.email ?? null,
        authType: "session",
        isServiceAdmin,
      };
      try {
        await upsertUser(session.user.id, session.user.email ?? null);
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

  const response = await resolve(event);

  /** Machine clients under the Gateway Key API tree should not receive HTML error pages. */
  if (event.url.pathname.startsWith("/keys/dashboard/api") || event.url.pathname.startsWith("/v1/")) {
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
};

export const config = {
  runtime: "nodejs",
};
