/**
 * R5: Agents / Wiring tab — moved from the /agents root page (which was /connect/mcp).
 * The workspace cache is warmed by the parent +layout.server.ts.
 */
import { perfSpan } from "$lib/debug/server-perf";
import type { PageServerLoad } from "./$types";
import { loadConnectAgentSetupForAgentsStep } from "$lib/server/connect/agent-setup-context";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import { sessionUser } from "$lib/server/session-user";

export const load: PageServerLoad = async (event) => {
  const user = sessionUser(event.locals);
  if (!user) {
    return { signedIn: false, agentSetup: Promise.resolve(null) };
  }
  const agentSetup = (async () => {
    const endMcp = perfSpan("connect/mcp", "loadConnectAgentSetup");
    try {
      const workspace = await requireConnectWorkspace(event.locals, event.parent);
      const setup = await loadConnectAgentSetupForAgentsStep({
        workspaceId: workspace.id,
        userId: user.uid,
      });
      endMcp();
      return setup;
    } catch {
      endMcp();
      return null;
    }
  })();
  return { signedIn: true, agentSetup };
};
