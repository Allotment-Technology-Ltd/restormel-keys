/**
 * W2.4 — Memory-writes inbox page server load.
 * Lists agent_observation units for the workspace, newest-first.
 */
import type { PageServerLoad } from "./$types";
import { listAgentMemoryObservationsPostgres, type AgentObservationRow } from "$lib/server/neon";
import { getConnectWorkspaceCached } from "$lib/server/connect/workspace-cache";
import { sessionUser } from "$lib/server/session-user";

export type MemoryInboxData = {
  observations: AgentObservationRow[];
  workspaceId: string;
};

export const load: PageServerLoad = async (event) => {
  const user = sessionUser(event.locals);
  if (!user) {
    return {
      inbox: Promise.resolve<MemoryInboxData | null>(null),
    };
  }

  const inbox: Promise<MemoryInboxData | null> = (async () => {
    try {
      const workspace = await getConnectWorkspaceCached(user.uid);
      const observations = await listAgentMemoryObservationsPostgres({
        workspaceId: workspace.id,
        limit: 50,
      });
      return { observations, workspaceId: workspace.id };
    } catch {
      return null;
    }
  })();

  return { inbox };
};
