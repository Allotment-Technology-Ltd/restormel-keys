import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  listEnvironments,
  listProjectsByWorkspace,
  listProviderIntegrations,
} from "$lib/server/db";
import {
  getConnectStageRouting,
  listConnectStageRouteRows,
} from "$lib/server/connect/stage-routing";
import { isLlmConfigured, knowledgeLlmModel } from "$lib/server/connect/llm-generate";
import { buildCrossModelProductionChain } from "$lib/server/connect/model-guidance";
import { ensureModelCatalogSynced } from "$lib/server/connect/model-catalog-sync";
import { getWorkspaceEmbeddingLock } from "$lib/server/connect/embedding-contract";
import { resolveUpstreamValidationContext } from "$lib/server/connect/resolve-stage-route-models";
import {
  getSelectedDomainPackId,
  listDomainPacksForUi,
  resolvePipelineDomainPack,
} from "$lib/server/connect/domain-pack-service";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import { listGraphTargetsForUi } from "$lib/server/connect/graph-target-service";
import type { ServerLoadEvent } from "@sveltejs/kit";

export async function loadConnectModelsPage(
  event: Pick<ServerLoadEvent, "locals" | "parent">,
) {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return null;
  }
  try {
    const workspace = await requireConnectWorkspace(
      event.locals,
      event.parent as () => Promise<{ connectWorkspace: { id: string; userId: string } | null }>,
    );
    const userId = event.locals.user.uid;

    void ensureModelCatalogSynced().catch((e) => {
      console.warn(
        "[connect] model catalog sync skipped:",
        e instanceof Error ? e.message.slice(0, 120) : String(e),
      );
    });

    const [routing, integrations, projects, activeGraph] = await Promise.all([
      getConnectStageRouting(workspace.id),
      listProviderIntegrations(workspace.id).catch(() => []),
      listProjectsByWorkspace(workspace.id),
      // RES-113 PR-2: the /routes/ingestion plug-point twin needs the active
      // graph's bundle. Fetched ONLY when the m1PlugPoints flag is ON — flag OFF
      // adds zero queries and the payload field stays null (byte-identical page).
      event.locals.moduleFlags?.m1PlugPoints === true
        ? listGraphTargetsForUi(workspace.id)
            .then((graphs) => graphs.find((g) => g.is_active) ?? null)
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const projectId = routing?.project_id ?? projects[0]?.id ?? null;
    let environmentId = routing?.environment_id ?? null;
    const environments = projectId ? await listEnvironments(projectId, userId) : [];
    if (projectId && !environmentId) {
      environmentId = environments[0]?.id ?? null;
    }

    const providerTypes = new Set(integrations.map((i) => i.providerType).filter(Boolean));

    const stageRowsRaw =
      projectId && environmentId
        ? await listConnectStageRouteRows({
            workspaceId: workspace.id,
            userId,
            projectId,
            environmentId,
            dashboardBase: DASHBOARD_BASE,
          })
        : [];

    const [packs, selectedPackId, upstream] = await Promise.all([
      listDomainPacksForUi(workspace.id).catch(() => []),
      getSelectedDomainPackId(workspace.id).catch(() => null),
      projectId && environmentId
        ? resolveUpstreamValidationContext({
            projectId,
            userId,
            environmentId,
            routing,
            stageRows: stageRowsRaw,
          }).catch(() => ({ upstream: [], providers: new Set<string>(), modelIds: new Set<string>() }))
        : Promise.resolve({ upstream: [], providers: new Set<string>(), modelIds: new Set<string>() }),
    ]);

    const activePack = resolvePipelineDomainPack(packs, selectedPackId);
    const embeddingLock = await getWorkspaceEmbeddingLock(workspace.id, {
      modelHint: activePack?.embedding?.model ?? null,
    }).catch(() => null);

    const productionChain = buildCrossModelProductionChain(providerTypes, {
      upstream,
      embeddingDimensions: activePack?.embedding?.dimensions ?? 1024,
      embeddingLock,
    });

    const stageRows = stageRowsRaw.map((row) => ({
      ...row,
      recommended: productionChain[row.key] ?? null,
    }));

    return {
      routing,
      projects,
      projectId,
      environmentId,
      environments,
      stageRows,
      canApplyRecommended: integrations.length > 0 && Boolean(projectId && environmentId),
      applyRecommendedApi: DASHBOARD_BASE + "/api/connect/pipeline/apply-recommended-routes",
      integrationsCount: integrations.length,
      llmReady: Boolean(routing?.project_id) || isLlmConfigured(),
      usesRoutes: Boolean(routing?.project_id),
      defaults: {
        chat: knowledgeLlmModel(),
        embedding: productionChain.embedding?.modelId ?? "voyage-3",
      },
      embeddingLock,
      activePackEmbedding: activePack?.embedding ?? { model: "voyage-3", dimensions: 1024 },
      upstreamValidationProviders: [...upstream.providers],
      apiBase: DASHBOARD_BASE + "/api/connect/pipeline/stage-models",
      // RES-113 PR-2: non-null ONLY when m1PlugPoints is ON and a graph is active —
      // the page renders the plug-point disclosure purely off this field.
      activeGraph: activeGraph ? { id: activeGraph.id, bundle: activeGraph.bundle } : null,
    };
  } catch {
    return null;
  }
}
