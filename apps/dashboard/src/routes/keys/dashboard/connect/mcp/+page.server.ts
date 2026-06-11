import { perfSpan } from "$lib/debug/server-perf";
import type { PageServerLoad } from "./$types";
import { loadConnectAgentSetupForAgentsStep } from "$lib/server/connect/agent-setup-context";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return { signedIn: false, agentSetup: Promise.resolve(null) };
  }
  const agentSetup = (async () => {
    const endMcp = perfSpan("connect/mcp", "loadConnectAgentSetup");
    try {
      const workspace = await requireConnectWorkspace(event.locals, event.parent);
      const setup = await loadConnectAgentSetupForAgentsStep({
        workspaceId: workspace.id,
        userId: event.locals.user!.uid,
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
