import type { PageServerLoad } from "./$types";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";
import { loadConnectGraphView } from "$lib/server/connect/graph-explorer-service";
import { isConnectIngestLlmReady } from "$lib/server/connect/stage-route-generate";
import {
  listConnectIngestionValidationRoutes,
  resolveKnowledgeRouteExecutionContext,
} from "$lib/server/connect/stage-routing";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.authType !== "session") {
    return { graph: null, revalidate: null };
  }
  try {
    const workspace = await getOrCreateDefaultWorkspace(locals.user.uid);
    const graph = await loadConnectGraphView(workspace.id);

    let revalidate: {
      enabled: boolean;
      routes: { id: string; name: string; isDefault: boolean }[];
      defaultRouteId: string | null;
    } | null = null;

    if (graph.reviewEnabled && graph.stats && graph.stats.units > 0) {
      const routeCtx = await resolveKnowledgeRouteExecutionContext({
        workspaceId: workspace.id,
        userId: locals.user.uid,
      });
      if (routeCtx) {
        const llmReady = await isConnectIngestLlmReady({
          workspaceId: workspace.id,
          routeCtx,
        });
        if (llmReady) {
          const routes = await listConnectIngestionValidationRoutes({
            workspaceId: workspace.id,
            userId: locals.user.uid,
            projectId: routeCtx.projectId,
            environmentId: routeCtx.environmentId,
          });
          revalidate = {
            enabled: true,
            routes,
            defaultRouteId:
              routeCtx.routing.routes?.validation ??
              routes.find((r) => r.isDefault)?.id ??
              routes[0]?.id ??
              null,
          };
        }
      }
    }

    return { graph, revalidate };
  } catch {
    return { graph: null, revalidate: null };
  }
};
