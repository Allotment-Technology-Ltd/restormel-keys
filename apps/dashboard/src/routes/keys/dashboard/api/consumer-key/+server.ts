import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { ensureZuploConsumer } from "$lib/server/zuplo-consumer";
import { verifyJwtRs256 } from "$lib/server/oidc";

export const GET: RequestHandler = async ({ locals, request }) => {
  // Developer Portal (Zudoku) calls cross-origin and cannot rely on dashboard cookies.
  // Accept an OIDC access token (JWT) from /keys/auth as Authorization: Bearer <token>.
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (bearer) {
    try {
      const { payload } = verifyJwtRs256(bearer);
      const workspaceId = typeof payload?.sub === "string" ? payload.sub : "";
      const email = typeof payload?.email === "string" ? payload.email : null;
      if (!workspaceId) return json({ error: "Unauthorized" }, { status: 401 });
      const key = await ensureZuploConsumer({ workspaceId, userEmail: email });
      return json({ key }, { headers: { "cache-control": "no-store" } });
    } catch {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Fallback: dashboard session (same-origin).
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  if (locals.user?.authType === "gateway_key" || locals.user?.authType === "management_key") {
    return json({ error: "Session auth required" }, { status: 403 });
  }

  try {
    const key = await ensureZuploConsumer({ workspaceId: ctx.workspaceId, userEmail: locals.user?.email ?? null });
    return json({ key }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to provision consumer key";
    return json({ error: "consumer_key_unavailable", detail: msg }, { status: 502 });
  }
};

