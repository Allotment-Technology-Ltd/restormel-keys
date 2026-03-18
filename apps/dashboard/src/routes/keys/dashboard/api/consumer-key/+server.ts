import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { ensureZuploConsumer } from "$lib/server/zuplo-consumer";
import { verifyJwtRs256 } from "$lib/server/oidc";
import { portalCorsHeaders, withPortalCors } from "$lib/server/portal-cors";

export const GET: RequestHandler = async ({ locals, request }) => {
  const cors = portalCorsHeaders(request, { allowMethods: ["GET", "OPTIONS"] });

  // Developer Portal (Zudoku) calls cross-origin and cannot rely on dashboard cookies.
  // Accept an OIDC access token (JWT) from /keys/auth as Authorization: Bearer <token>.
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (bearer) {
    try {
      const { payload } = verifyJwtRs256(bearer);
      const workspaceId = typeof payload?.sub === "string" ? payload.sub : "";
      const email = typeof payload?.email === "string" ? payload.email : null;
      if (!workspaceId) return json({ error: "Unauthorized" }, withPortalCors({ status: 401 }, cors));
      const key = await ensureZuploConsumer({ workspaceId, userEmail: email });
      return json({ key }, withPortalCors({ headers: { "cache-control": "no-store" } }, cors));
    } catch {
      return json({ error: "Unauthorized" }, withPortalCors({ status: 401 }, cors));
    }
  }

  // Fallback: dashboard session (same-origin).
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, withPortalCors({ status: 401 }, cors));
  if (locals.user?.authType === "gateway_key" || locals.user?.authType === "management_key") {
    return json({ error: "Session auth required" }, withPortalCors({ status: 403 }, cors));
  }

  try {
    const key = await ensureZuploConsumer({ workspaceId: ctx.workspaceId, userEmail: locals.user?.email ?? null });
    return json({ key }, withPortalCors({ headers: { "cache-control": "no-store" } }, cors));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to provision consumer key";
    return json({ error: "consumer_key_unavailable", detail: msg }, withPortalCors({ status: 502 }, cors));
  }
};

export const OPTIONS: RequestHandler = async ({ request }) => {
  const cors = portalCorsHeaders(request, { allowMethods: ["GET", "OPTIONS"] });
  if (!cors) return new Response(null, { status: 204 });
  return new Response(null, withPortalCors({ status: 204 }, cors));
};

