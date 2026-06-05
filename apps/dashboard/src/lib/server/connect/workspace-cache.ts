import type { ServerLoadEvent } from "@sveltejs/kit";
import { perfSpan } from "$lib/debug/server-perf";
import { getOrCreateDefaultWorkspace, type Workspace } from "$lib/server/db";

const WORKSPACE_CACHE_MS = 30_000;

type CacheEntry = { at: number; workspace: Workspace };
const workspaceByUser = new Map<string, CacheEntry>();

/** Short-lived cache — avoids repeated workspace lookups on Connect tab hops. */
export async function getConnectWorkspaceCached(userId: string): Promise<Workspace> {
  const hit = workspaceByUser.get(userId);
  if (hit && Date.now() - hit.at < WORKSPACE_CACHE_MS) {
    return hit.workspace;
  }
  const end = perfSpan("connect/workspace", "getOrCreateDefaultWorkspace");
  const workspace = await getOrCreateDefaultWorkspace(userId);
  end();
  workspaceByUser.set(userId, { at: Date.now(), workspace });
  return workspace;
}

export function invalidateConnectWorkspaceCache(userId: string): void {
  workspaceByUser.delete(userId);
}

type ConnectLayoutParent = { connectWorkspace: { id: string; userId: string } | null };

/** After Connect layout load, workspace is cached — cheap on tab hops. */
export async function requireConnectWorkspace(
  locals: App.Locals,
  parent: () => Promise<ConnectLayoutParent>,
): Promise<Workspace> {
  if (!locals.user || locals.user.authType !== "session") {
    throw new Error("connect_workspace_requires_session");
  }
  await parent();
  return getConnectWorkspaceCached(locals.user.uid);
}

export async function loadConnectLayoutWorkspace(
  event: Pick<ServerLoadEvent, "locals">,
): Promise<{ connectWorkspace: { id: string; userId: string } | null }> {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return { connectWorkspace: null };
  }
  const end = perfSpan("connect/layout", "loadConnectLayoutWorkspace");
  const workspace = await getConnectWorkspaceCached(event.locals.user.uid);
  end();
  return { connectWorkspace: { id: workspace.id, userId: event.locals.user.uid } };
}
