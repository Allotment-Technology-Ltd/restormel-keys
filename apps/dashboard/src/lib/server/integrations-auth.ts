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
  };
};

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
  const workspace = await getOrCreateDefaultWorkspace(locals.user.uid);
  return {
    workspaceId: workspace.id,
    actorId: locals.user.uid,
    actorType: "user",
  };
}
