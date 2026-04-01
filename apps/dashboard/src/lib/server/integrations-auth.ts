/**
 * Resolve workspace and actor for Provider Integrations API.
 * Only session and management_key can access; gateway_key cannot (integrations are workspace-scoped).
 */
import { getOrCreateDefaultWorkspace } from "$lib/server/neon";

export type IntegrationsLocals = {
  user?: {
    uid: string;
    authType?: "session" | "gateway_key" | "management_key";
    projectIdForKey?: string;
    keyId?: string;
    workspaceId?: string;
    isServiceAdmin?: boolean;
  };
};

function isDbNotReadyError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  // Postgres: undefined table / undefined column (common when migrations not applied)
  return code === "42P01" || code === "42703";
}

export async function getWorkspaceAndActor(
  locals: IntegrationsLocals
): Promise<{ workspaceId: string; actorId: string; actorType: string } | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key") return null;
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    return {
      workspaceId: locals.user.workspaceId,
      actorId: locals.user.keyId ?? "management_key",
      actorType: "management_key",
    };
  }
  let workspace;
  try {
    workspace = await getOrCreateDefaultWorkspace(locals.user.uid);
  } catch (e) {
    if (isDbNotReadyError(e)) {
      console.warn("[db] not ready (missing migrations) — treating as unauthenticated for now");
      return null;
    }
    throw e;
  }
  return {
    workspaceId: workspace.id,
    actorId: locals.user.uid,
    actorType: "user",
  };
}
