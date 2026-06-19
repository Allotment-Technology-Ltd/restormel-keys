import type { PageServerLoad } from "./$types";
import { perfSpan } from "$lib/debug/server-perf";
import { loadConnectGraphView } from "$lib/server/connect/graph-explorer-service";
import { loadConnectSpine } from "$lib/server/connect/connect-hub-load";
import { getConnectWorkspaceCached } from "$lib/server/connect/workspace-cache";
import { sessionUser } from "$lib/server/session-user";

export const load: PageServerLoad = async (event) => {
  const user = sessionUser(event.locals);
  if (!user) {
    return { signedIn: false, graph: Promise.resolve(null), spine: Promise.resolve(null) };
  }

  const workspace = await getConnectWorkspaceCached(user.uid);
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

  // Phase 2 spine — streamed so it never blocks the explorer's primary render.
  const spine = loadConnectSpine(event);

  return { signedIn: true, graph, spine };
};
