/**
 * Session-scoped workspace/project context for the Knowledge operator BFF.
 * The dashboard Knowledge UI never asks operators to paste workspace UUIDs:
 * we resolve the signed-in user's default workspace here.
 */
import { getOrCreateDefaultWorkspace, listProjectsByWorkspace } from "$lib/server/db";

export type ConnectSessionContext = {
  userId: string;
  workspaceId: string;
  projects: { id: string; name: string }[];
};

export type ConnectSessionFailure = { status: 401; error: string; message: string };

export async function resolveKnowledgeSessionContext(
  locals: App.Locals,
): Promise<ConnectSessionContext | ConnectSessionFailure> {
  const user = locals.user;
  if (!user || user.authType !== "session" || !user.uid) {
    return { status: 401, error: "unauthorized", message: "Sign in to manage Knowledge ingestion." };
  }
  const workspace = await getOrCreateDefaultWorkspace(user.uid);
  const projects = await listProjectsByWorkspace(workspace.id);
  return {
    userId: user.uid,
    workspaceId: workspace.id,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
  };
}

export function isKnowledgeSessionFailure(
  ctx: ConnectSessionContext | ConnectSessionFailure,
): ctx is ConnectSessionFailure {
  return "status" in ctx;
}
