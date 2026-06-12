import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getOrCreateDefaultWorkspace, listProviderIntegrations } from "$lib/server/db";
import {
  INGEST_STAGE_MODEL_GUIDANCE,
  filterRecommendationsByProviders,
  buildCrossModelProductionChain,
} from "$lib/server/connect/model-guidance";
import { getConnectStageRouting, listConnectStageRouteRows } from "$lib/server/connect/stage-routing";
import { getWorkspaceEmbeddingLock } from "$lib/server/connect/embedding-contract";
import {
  resolveUpstreamValidationContext,
  type UpstreamValidationContext,
} from "$lib/server/connect/resolve-stage-route-models";
import {
  getSelectedDomainPackId,
  listDomainPacksForUi,
  resolvePipelineDomainPack,
} from "$lib/server/connect/domain-pack-service";
import { listEnvironments, listProjectsByWorkspace } from "$lib/server/db";
import { sessionUser } from "$lib/server/session-user";

export const GET: RequestHandler = async ({ locals }) => {
  const user = sessionUser(locals);
  if (!user) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  const workspace = await getOrCreateDefaultWorkspace(user.uid);
  const userId = user.uid;
  const integrations = await listProviderIntegrations(workspace.id).catch(() => []);
  const providerTypes = new Set(integrations.map((i) => i.providerType).filter(Boolean));

  const [routing, projects, packs, selectedPackId] = await Promise.all([
    getConnectStageRouting(workspace.id),
    listProjectsByWorkspace(workspace.id),
    listDomainPacksForUi(workspace.id).catch(() => []),
    getSelectedDomainPackId(workspace.id).catch(() => null),
  ]);

  const projectId = routing?.project_id ?? projects[0]?.id ?? null;
  let environmentId = routing?.environment_id ?? null;
  if (projectId && !environmentId) {
    const envs = await listEnvironments(projectId, userId);
    environmentId = envs[0]?.id ?? null;
  }

  const activePack = resolvePipelineDomainPack(packs, selectedPackId);
  const embeddingLock = await getWorkspaceEmbeddingLock(workspace.id, {
    modelHint: activePack?.embedding?.model ?? null,
  }).catch(() => null);

  let upstream: UpstreamValidationContext = {
    upstream: [],
    providers: new Set<string>(),
    modelIds: new Set<string>(),
  };
  if (projectId && environmentId) {
    const stageRows = await listConnectStageRouteRows({
      workspaceId: workspace.id,
      userId,
      projectId,
      environmentId,
    });
    upstream = await resolveUpstreamValidationContext({
      projectId,
      userId,
      environmentId,
      routing,
      stageRows,
    }).catch(() => upstream);
  }

  const productionChain = buildCrossModelProductionChain(providerTypes, {
    upstream,
    embeddingDimensions: activePack?.embedding?.dimensions ?? 1024,
    embeddingLock,
  });

  const stages = INGEST_STAGE_MODEL_GUIDANCE.map((g) => ({
    stage: g.stage,
    label: g.label,
    criteria: g.criteria,
    cross_model_note: g.crossModelNote ?? null,
    production: filterRecommendationsByProviders(g.production, providerTypes),
    economy: filterRecommendationsByProviders(g.economy, providerTypes),
    recommended: productionChain[g.stage] ?? null,
  }));

  return json({
    last_updated: "2026-06-05",
    provider_types: [...providerTypes],
    upstream_validation_providers: [...upstream.providers],
    embedding_lock: embeddingLock,
    active_pack_embedding: activePack?.embedding ?? { model: "voyage-3", dimensions: 1024 },
    stages,
    production_chain: productionChain,
  });
};
