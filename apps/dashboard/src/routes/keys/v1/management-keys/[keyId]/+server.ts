/**
 * DELETE /keys/v1/management-keys/{keyId} — revoke a management key.
 * Session auth required. Only the workspace owner (via session) may revoke.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";
import { revokeManagementKey } from "$lib/server/neon";

function sessionUserId(locals: App.Locals): string | null {
  if (!locals.user) return null;
  if (locals.user.authType !== "session") return null;
  return locals.user.uid || null;
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const uid = sessionUserId(locals);
  if (!uid) {
    return json(
      { error: "unauthorized", message: "Session authentication required to revoke management keys" },
      { status: 401 },
    );
  }
  const workspace = await getOrCreateDefaultWorkspace(uid);
  const revoked = await revokeManagementKey({
    keyId: params.keyId,
    workspaceId: workspace.id,
    actorId: uid,
  });
  if (!revoked) {
    return json(
      { error: "not_found", message: "Management key not found in your workspace" },
      { status: 404 },
    );
  }
  return json({ ok: true });
};
