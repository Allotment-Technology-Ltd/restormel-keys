import type { PageServerLoad } from "./$types";
import { perfSpan } from "$lib/debug/server-perf";
import { loadConnectGraphView } from "$lib/server/connect/graph-explorer-service";
import { getConnectWorkspaceCached } from "$lib/server/connect/workspace-cache";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return { graph: Promise.resolve(null) };
  }

  const workspace = await getConnectWorkspaceCached(event.locals.user.uid);
  event.depends(`app:connect-graph:${workspace.id}`);

  const graph = (async () => {
    try {
      const endGraph = perfSpan("connect/graph", "loadConnectGraphView");
      const view = await loadConnectGraphView(workspace.id, {
        skipUnits: true,
        skipGroups: true,
      });
      endGraph();
      return view;
    } catch {
      return null;
    }
  })();

  return { graph };
};
