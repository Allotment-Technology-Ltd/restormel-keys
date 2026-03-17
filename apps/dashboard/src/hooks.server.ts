/**
 * Neon Auth session or Bearer key (Gateway / Management). Populates event.locals.user.
 * Session: uid, email. Gateway key: uid = project owner, projectIdForKey, keyId. Management key: workspaceId, keyId.
 * Adds X-Session-Cookie for proxy when response sets cookie.
 */
import type { Handle } from "@sveltejs/kit";
import { getSession } from "$lib/server/auth";
import { upsertUser } from "$lib/server/db";
import { getBearerToken } from "$lib/server/bearer";
import { verifyGatewayKey, verifyManagementKey } from "$lib/server/neon";

export const handle: Handle = async ({ event, resolve }) => {
  // #region agent log
  fetch('http://127.0.0.1:7463/ingest/4d73a77a-e2c7-48aa-ae41-73a13b42405f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fc0f8'},body:JSON.stringify({sessionId:'4fc0f8',location:'hooks.server.ts:12',message:'request reached SvelteKit handle',data:{method:event.request.method,url:event.url.pathname,host:event.url.host},timestamp:Date.now(),hypothesisId:'C-D'})}).catch(()=>{});
  // #endregion
  try {
    const { data: session } = await getSession(event.request, event.url.host);
    if (session?.user) {
      event.locals.user = {
        uid: session.user.id,
        email: session.user.email ?? null,
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
