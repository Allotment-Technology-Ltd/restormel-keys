/**
 * GET /api/connect/memory — list agent observation inbox (W2.4).
 * Session auth; returns the workspace's agent-written claims newest-first.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listAgentMemoryObservationsPostgres } from "$lib/server/neon";
import { getConnectWorkspaceCached } from "$lib/server/connect/workspace-cache";

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user || locals.user.authType !== "session") {
    return json({ error: "unauthorized", message: "Sign in required." }, { status: 401 });
  }

  const workspace = await getConnectWorkspaceCached(locals.user.uid);
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;
  const offset = offsetParam ? Math.max(parseInt(offsetParam, 10) || 0, 0) : 0;

  try {
    const observations = await listAgentMemoryObservationsPostgres({
      workspaceId: workspace.id,
      limit,
      offset,
    });
    return json({ ok: true, observations, workspaceId: workspace.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json(
      { error: "load_failed", message: message.slice(0, 280) },
      { status: 502 },
    );
  }
};
