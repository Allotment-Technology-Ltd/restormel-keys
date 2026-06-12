/**
 * Session-scoped workspace/project context for the Knowledge operator BFF.
 * The dashboard Knowledge UI never asks operators to paste workspace UUIDs:
 * we resolve the signed-in user's default workspace here.
 */
import { listProjectsByWorkspace } from "$lib/server/db";
import { getConnectWorkspaceCached } from "$lib/server/connect/workspace-cache";

export type ConnectSessionContext = {
  userId: string;
  workspaceId: string;
  projects: { id: string; name: string }[];
};

export type ConnectSessionFailure = { status: 401; error: string; message: string };

export async function resolveKnowledgeSessionContext(
  locals: App.Locals,
  options?: {
    /**
     * Hot polled endpoints (e.g. the run-console status poll) don't use the
     * projects list — skip its Neon round-trip. Defaults to true, preserving
     * the original shape for every other caller.
     */
    includeProjects?: boolean;
  },
): Promise<ConnectSessionContext | ConnectSessionFailure> {
  const user = locals.user;
  if (!user || user.authType !== "session" || !user.uid) {
    return { status: 401, error: "unauthorized", message: "Sign in to manage Knowledge ingestion." };
  }
  // 30s-cached default workspace (same cache the Connect layout uses) — the
  // user→workspace mapping is created once per user and never changes.
  const workspace = await getConnectWorkspaceCached(user.uid);
  const projects =
    options?.includeProjects === false ? [] : await listProjectsByWorkspace(workspace.id);
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
