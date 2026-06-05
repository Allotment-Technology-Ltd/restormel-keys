import { isConnectIngestLlmReady } from "$lib/server/connect/stage-route-generate";
import {
  listConnectIngestionEmbeddingRoutes,
  resolveKnowledgeRouteExecutionContext,
  type ConnectValidationRouteOption,
} from "$lib/server/connect/stage-routing";
import { resolveConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import { loadPostgresUnembeddedPreview } from "$lib/server/connect/graph-embed-backfill-service";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";

export type GraphEmbedBackfillOptions = {
  enabled: boolean;
  projectId: string;
  totalUnits: number;
  embeddedCount: number;
  unembeddedCount: number;
  embedReady: boolean;
  routes: ConnectValidationRouteOption[];
  defaultRouteId: string | null;
  previewUnits: { id: string; text: string }[];
};

export async function loadGraphEmbedBackfillOptions(
  workspaceId: string,
  userId: string,
): Promise<GraphEmbedBackfillOptions | null> {
  const [stats, target] = await Promise.all([
    resolveConnectGraphStats(workspaceId).catch(() => null),
    getConnectGraphTargetForWorkspace(workspaceId),
  ]);
  if (!stats || stats.units === 0 || !target) return null;

  const unembeddedCount = Math.max(0, stats.units - stats.embedded);
  if (unembeddedCount === 0) return null;

  const routeCtx = await resolveKnowledgeRouteExecutionContext({ workspaceId, userId });
  const llmReady = await isConnectIngestLlmReady({ workspaceId, routeCtx });

  const routes =
    routeCtx != null
      ? await listConnectIngestionEmbeddingRoutes({
          workspaceId,
          userId,
          projectId: routeCtx.projectId,
          environmentId: routeCtx.environmentId,
        })
      : [];

  const embedReady = llmReady && (routes.length > 0 || Boolean(routeCtx?.routing.routes?.embedding));

  let previewUnits: { id: string; text: string }[] = [];
  if (target.provider === "postgres") {
    previewUnits = await loadPostgresUnembeddedPreview(workspaceId).catch(() => []);
  }

  return {
    enabled: true,
    projectId: routeCtx?.projectId ?? "",
    totalUnits: stats.units,
    embeddedCount: stats.embedded,
    unembeddedCount,
    embedReady,
    routes,
    defaultRouteId:
      routeCtx?.routing.routes?.embedding ??
      routes.find((r) => r.isDefault)?.id ??
      routes[0]?.id ??
      null,
    previewUnits,
  };
}
