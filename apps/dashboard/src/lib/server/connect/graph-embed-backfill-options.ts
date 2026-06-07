import { isConnectIngestLlmReady } from "$lib/server/connect/stage-route-generate";
import {
  listConnectIngestionEmbeddingRoutes,
  resolveKnowledgeRouteExecutionContext,
  type ConnectValidationRouteOption,
} from "$lib/server/connect/stage-routing";
import { peekConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import { loadPostgresUnembeddedPreview } from "$lib/server/connect/graph-embed-backfill-service";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import {
  auditGraphEmbeddingHealth,
  type GraphEmbeddingHealth,
} from "$lib/server/connect/graph-embedding-health";

export type GraphEmbedBackfillOptions = {
  enabled: boolean;
  projectId: string;
  totalUnits: number;
  embeddedCount: number;
  unembeddedCount: number;
  workCount: number;
  embedReady: boolean;
  routes: ConnectValidationRouteOption[];
  defaultRouteId: string | null;
  previewUnits: { id: string; text: string }[];
  health: GraphEmbeddingHealth;
  /** Use uniform_target when dimension mismatches exist. */
  recommendedScope: "missing_only" | "uniform_target";
};

export async function loadGraphEmbedBackfillOptions(
  workspaceId: string,
  userId: string,
): Promise<GraphEmbedBackfillOptions | null> {
  const [stats, target] = await Promise.all([
    peekConnectGraphStats(workspaceId).catch(() => null),
    getConnectGraphTargetForWorkspace(workspaceId),
  ]);
  if (!stats || stats.units === 0 || !target) return null;

  const health = await auditGraphEmbeddingHealth(workspaceId, stats, { fast: true });
  if (!health) return null;

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
  if (target.provider === "postgres" && health.actionNeeded) {
    previewUnits = await loadPostgresUnembeddedPreview(workspaceId).catch(() => []);
  }

  const recommendedScope: "missing_only" | "uniform_target" =
    health.mismatchedDimensionCount > 0 || health.hasMixedDimensions
      ? "uniform_target"
      : "missing_only";

  return {
    enabled: true,
    projectId: routeCtx?.projectId ?? "",
    totalUnits: stats.units,
    embeddedCount: stats.embedded,
    unembeddedCount: health.unembeddedCount,
    workCount: health.workCount,
    embedReady,
    routes,
    defaultRouteId:
      routeCtx?.routing.routes?.embedding ??
      routes.find((r) => r.isDefault)?.id ??
      routes[0]?.id ??
      null,
    previewUnits,
    health,
    recommendedScope,
  };
}
