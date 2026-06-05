import type { PageServerLoad } from "./$types";
import { perfSpan } from "$lib/debug/server-perf";
import { GRAPH_EXPLORER_PAGE_SIZE, loadConnectGraphView } from "$lib/server/connect/graph-explorer-service";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return { graph: Promise.resolve(null) };
  }

  const graph = (async () => {
    try {
      const endWorkspace = perfSpan("connect/graph", "workspace");
      const workspace = await requireConnectWorkspace(event.locals, event.parent);
      endWorkspace();
      event.depends(`app:connect-graph:${workspace.id}`);
      const endGraph = perfSpan("connect/graph", "loadConnectGraphView");
      const view = await loadConnectGraphView(workspace.id, { unitLimit: GRAPH_EXPLORER_PAGE_SIZE });
      endGraph();
      return view;
    } catch {
      return null;
    }
  })();

  return { graph };
};
