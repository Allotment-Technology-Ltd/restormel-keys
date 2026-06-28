import type { ConnectAgentSetupData } from "$lib/connect/agent-setup-types";
import { getGraphTargetForUi } from "$lib/server/connect/graph-target-service";
import { computeConnectModelsReady, getConnectStageRouting } from "$lib/server/connect/stage-routing";
import { isLlmConfigured } from "$lib/server/connect/llm-generate";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { listApiKeysByWorkspace, listProjects, listProviderIntegrations } from "$lib/server/db";
import { resolveConnectGraphStats } from "$lib/server/connect/graph-explorer-service";

type GraphTargetUi = Awaited<ReturnType<typeof getGraphTargetForUi>>;

/**
 * W3.7/K1: Load gateway keys for agent setup using a single workspace-scoped query.
 * Before: called listApiKeys per project in a loop (N+1 — K-P2-3).
 * After: listApiKeysByWorkspace — one JOIN, no loop.
 * Also: exposes server-persisted label for display in ConnectAgentSetup.
 */
async function loadGatewayKeysForUser(userId: string, workspaceId: string): Promise<{
  projects: ConnectAgentSetupData["projects"];
  gatewayKeys: ConnectAgentSetupData["gatewayKeys"];
}> {
  const [projects, keyRows] = await Promise.all([
    listProjects(userId),
    listApiKeysByWorkspace(workspaceId),
  ]);
  const gatewayKeys: ConnectAgentSetupData["gatewayKeys"] = keyRows.map((key) => ({
    id: key.id,
    keyPrefix: key.keyPrefix,
    projectId: key.projectId,
    projectName: key.projectName,
    label: key.label ?? null,
    // RES-113 PR-L — enforced scope (null on legacy keys / flag OFF). key_hash is never carried.
    keyType: key.keyType ?? null,
    access: key.access ?? null,
  }));
  return { projects, gatewayKeys };
}

/**
 * MCP / Gateway key payload — stats-only graph check (no full unit load).
 */
export async function loadConnectAgentSetupForAgentsStep(params: {
  workspaceId: string;
  userId: string;
  connectApiBase?: string;
  preloaded?: {
    target?: GraphTargetUi;
    stats?: Awaited<ReturnType<typeof resolveConnectGraphStats>> | null;
    integrationsCount?: number;
  };
}): Promise<ConnectAgentSetupData> {
  const { workspaceId, userId, connectApiBase = "https://restormel.dev", preloaded } = params;

  const [target, stats, integrations, routing, gateway] = await Promise.all([
    preloaded?.target !== undefined ? Promise.resolve(preloaded.target) : getGraphTargetForUi(workspaceId),
    preloaded?.stats !== undefined
      ? Promise.resolve(preloaded.stats)
      : resolveConnectGraphStats(workspaceId).catch(() => null),
    preloaded?.integrationsCount !== undefined
      ? Promise.resolve({ length: preloaded.integrationsCount })
      : listProviderIntegrations(workspaceId).catch(() => []),
    getConnectStageRouting(workspaceId),
    loadGatewayKeysForUser(userId, workspaceId),
  ]);

  const hasGraph = Boolean(stats && stats.units > 0);
  const surrealStoreReady = Boolean(target?.provider === "surreal" && target.status === "ok");
  const workspaceStoreReady = Boolean(target?.provider === "postgres" && target.status === "ok");
  const modelsStatus = await computeConnectModelsReady({
    workspaceId,
    userId,
    integrationsCount: integrations.length,
    llmReady: isLlmConfigured(),
    dashboardBase: DASHBOARD_BASE,
  });

  const routingProjectId = routing?.project_id ?? null;
  const defaultProjectId =
    routingProjectId && gateway.projects.some((p) => p.id === routingProjectId)
      ? routingProjectId
      : (gateway.projects[0]?.id ?? null);

  return {
    workspaceId,
    projectId: routingProjectId,
    surrealStoreReady,
    workspaceStoreReady,
    modelsReady: modelsStatus.modelsReady,
    hasGraph,
    agentReady: surrealStoreReady && modelsStatus.modelsReady && hasGraph,
    graphTargetStatus: target?.status ?? null,
    connectApiBase,
    projects: gateway.projects,
    gatewayKeys: gateway.gatewayKeys,
    defaultProjectId,
  };
}
