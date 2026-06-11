/**
 * POST /api/connect/memory/[unitId]/revoke — soft-revoke an agent observation (W2.4).
 * Reversible: sets verification_state = 'excluded'; the row is not deleted.
 * Session auth; workspace-scoped.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { revokeAgentObservationPostgres, invalidateConnectGraphStatsCache } from "$lib/server/neon";
import { getConnectWorkspaceCached } from "$lib/server/connect/workspace-cache";

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.user || locals.user.authType !== "session") {
    return json({ error: "unauthorized", message: "Sign in required." }, { status: 401 });
  }

  const unitId = decodeURIComponent(params.unitId ?? "").trim();
  if (!unitId) {
    return json({ error: "invalid_request", message: "Unit id is required." }, { status: 400 });
  }

  const workspace = await getConnectWorkspaceCached(locals.user.uid);

  try {
    const result = await revokeAgentObservationPostgres({
      workspaceId: workspace.id,
      unitId,
    });
    // Invalidate stats cache so trust scorecard reflects the change.
    await invalidateConnectGraphStatsCache({ workspaceId: workspace.id }).catch(() => {});
    return json({ ok: result.ok, unit_id: unitId, state: "excluded" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json(
      { error: "revoke_failed", message: message.slice(0, 280) },
      { status: 502 },
    );
  }
};
