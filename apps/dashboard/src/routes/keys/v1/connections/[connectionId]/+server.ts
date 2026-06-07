/**
 * GET /keys/v1/connections/{connectionId} — get a single source connection.
 *
 * Auth: session, management_key, or gateway_key (read-only; I9).
 * Write operations remain session-only (use the dashboard API).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getOrCreateDefaultWorkspace, getProjectById } from "$lib/server/db";
import { connectionRecordToApi } from "$lib/server/connect/connections-service";
import { getConnectSourceConnection } from "$lib/server/neon";

async function resolveWorkspaceId(locals: App.Locals): Promise<string | null> {
  const user = locals.user;
  if (!user) return null;

  if (user.authType === "management_key" && user.workspaceId) {
    return user.workspaceId;
  }

  if (user.authType === "gateway_key" && user.projectIdForKey) {
    const project = await getProjectById(user.projectIdForKey);
    return project?.workspaceId ?? null;
  }

  if (user.authType === "session" && user.uid) {
    const workspace = await getOrCreateDefaultWorkspace(user.uid);
    return workspace.id;
  }

  return null;
}

export const GET: RequestHandler = async ({ params, locals }) => {
  const workspaceId = await resolveWorkspaceId(locals);
  if (!workspaceId) {
    return json(
      { error: "unauthorized", message: "Gateway key, management key, or session required" },
      { status: 401 },
    );
  }
  const record = await getConnectSourceConnection({ id: params.connectionId, workspaceId });
  if (!record) {
    return json({ error: "not_found", message: "Connection not found" }, { status: 404 });
  }
  return json({ data: connectionRecordToApi(record) });
};
