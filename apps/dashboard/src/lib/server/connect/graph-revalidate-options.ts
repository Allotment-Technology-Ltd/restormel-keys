import { isConnectIngestLlmReady } from "$lib/server/connect/stage-route-generate";
import {
  listConnectIngestionRemediationRoutes,
  listConnectIngestionValidationRoutes,
  resolveKnowledgeRouteExecutionContext,
  type ConnectValidationRouteOption,
} from "$lib/server/connect/stage-routing";
import { peekConnectGraphStats } from "$lib/server/connect/graph-explorer-service";

export type GraphRevalidateOptions = {
  enabled: boolean;
  projectId: string;
  routes: ConnectValidationRouteOption[];
  defaultRouteId: string | null;
  remediationRoutes: ConnectValidationRouteOption[];
  defaultRemediationRouteId: string | null;
  quarantineCount: number;
  unsupportedUntriagedCount: number;
  embedReady: boolean;
};

export async function loadGraphRevalidateOptions(
  workspaceId: string,
  userId: string,
): Promise<GraphRevalidateOptions | null> {
  const stats = await peekConnectGraphStats(workspaceId).catch(() => null);
  if (!stats || stats.units === 0) return null;

  const routeCtx = await resolveKnowledgeRouteExecutionContext({ workspaceId, userId });
  if (!routeCtx) return null;

  const llmReady = await isConnectIngestLlmReady({ workspaceId, routeCtx });
  if (!llmReady) return null;

  const [routes, remediationRoutes] = await Promise.all([
    listConnectIngestionValidationRoutes({
      workspaceId,
      userId,
      projectId: routeCtx.projectId,
      environmentId: routeCtx.environmentId,
    }),
    listConnectIngestionRemediationRoutes({
      workspaceId,
      userId,
      projectId: routeCtx.projectId,
      environmentId: routeCtx.environmentId,
    }),
  ]);

  const embedReady = Boolean(routeCtx.routing.routes?.embedding) || !routeCtx.routing.routes;

  return {
    enabled: true,
    projectId: routeCtx.projectId,
    routes,
    defaultRouteId:
      routeCtx.routing.routes?.validation ??
      routes.find((r) => r.isDefault)?.id ??
      routes[0]?.id ??
      null,
    remediationRoutes,
    defaultRemediationRouteId:
      routeCtx.routing.routes?.remediation ??
      remediationRoutes.find((r) => r.isDefault)?.id ??
      remediationRoutes[0]?.id ??
      null,
    quarantineCount: stats.validation.awaiting_triage,
    unsupportedUntriagedCount: stats.validation.unsupported_untriaged,
    embedReady,
  };
}
