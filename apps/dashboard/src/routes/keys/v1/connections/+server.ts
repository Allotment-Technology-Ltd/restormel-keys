/**
 * GET /keys/v1/connections — list source connections for the caller's workspace.
 *
 * Auth: session, management_key, or gateway_key (read-only; I9).
 * Write operations (POST/DELETE) remain session-only (use the dashboard API).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getOrCreateDefaultWorkspace, getProjectById } from "$lib/server/db";
import { listConnections } from "$lib/server/connect/connections-service";

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

export const GET: RequestHandler = async ({ locals }) => {
  const workspaceId = await resolveWorkspaceId(locals);
  if (!workspaceId) {
    return json(
      { error: "unauthorized", message: "Gateway key, management key, or session required" },
      { status: 401 },
    );
  }
  const connections = await listConnections(workspaceId);
  return json({ data: connections });
};
