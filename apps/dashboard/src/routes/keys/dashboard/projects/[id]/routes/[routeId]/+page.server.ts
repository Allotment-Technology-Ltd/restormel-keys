import type { PageServerLoad } from "./$types";
import {
  getProject,
  getProjectInWorkspace,
  getRouteWithSteps,
  getModel,
  getModelsLifecycleByIds,
  listPolicies,
  listPolicyBindingsByTarget,
  listModels,
  listProviderModelVariantsByModelIds,
  listRouteStepEdges,
} from "$lib/server/db";
import {
  ensureModelCatalogSynced,
  getModelCatalogSeedVersion,
} from "$lib/server/connect/model-catalog-sync";
import {
  buildModelIdsByProvider,
  enrichIngestionRouteBuilderCatalog,
  recommendedModelIdsForIngestionStage,
} from "$lib/server/connect/route-builder-model-catalog";
import { INGESTION_STAGE_IDS, INGESTION_WORKLOAD } from "$lib/server/ingestion-routing";
import { expandPoolMembersFromStep } from "$lib/server/model-pool";

async function projectScope(
  locals: App.Locals,
  projectId: string
): Promise<{ projectId: string; userId: string } | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key") {
    if (locals.user.projectIdForKey !== projectId) return null;
    return { projectId, userId: locals.user.uid };
  }
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    const project = await getProjectInWorkspace(projectId, locals.user.workspaceId);
    return project ? { projectId, userId: project.userId } : null;
  }
  const project = await getProject(projectId, locals.user.uid);
  return project ? { projectId, userId: locals.user.uid } : null;
}

export const load: PageServerLoad = async ({ params, depends, locals }) => {
  /** Narrow client `invalidate()` so step/route edits do not rerun every layout load. */
  depends(`app:route-detail:${params.routeId}`);
  depends(`app:model-catalog:${getModelCatalogSeedVersion()}`);
  const scope = await projectScope(locals, params.id);
  if (!scope) {
    return {
      project: null,
      route: null,
      steps: [],
      modelLifecycleWarnings: [],
      availablePolicies: [],
      routePolicyBindings: [],
      routeStepLinks: [],
      stepPolicyBindings: [],
      modelOptions: [],
      modelCatalog: [],
      modelIdsByProvider: {},
      recommendedModelIds: [] as string[],
      catalogSeedVersion: getModelCatalogSeedVersion(),
      ingestionWorkload: INGESTION_WORKLOAD,
      ingestionStageIds: [...INGESTION_STAGE_IDS],
      error: "Not found",
    };
  }
  try {
    const result = await getRouteWithSteps(params.routeId, scope.projectId, scope.userId);
    if (!result) {
      return {
        project: null,
        route: null,
        steps: [],
        modelLifecycleWarnings: [],
        availablePolicies: [],
        routePolicyBindings: [],
        routeStepLinks: [],
        stepPolicyBindings: [],
        modelOptions: [],
        modelCatalog: [],
        modelIdsByProvider: {},
        recommendedModelIds: [] as string[],
        catalogSeedVersion: getModelCatalogSeedVersion(),
        ingestionWorkload: INGESTION_WORKLOAD,
        ingestionStageIds: [...INGESTION_STAGE_IDS],
        error: "Route not found",
      };
    }
    const modelIds: string[] = [];
    if (result.route.defaultModelId) modelIds.push(result.route.defaultModelId);
    for (const s of result.steps) {
      const { candidates } = expandPoolMembersFromStep(s, result.route.defaultModelId ?? null);
      for (const c of candidates) {
        if (c.modelId) modelIds.push(c.modelId);
      }
    }
    const lifecycleList = await getModelsLifecycleByIds(modelIds);
    const deprecatedStates = new Set(["deprecated", "retired"]);
    const modelLifecycleWarnings = lifecycleList.filter(
      (m) => m.lifecycleState && deprecatedStates.has(m.lifecycleState.toLowerCase())
    );
    const project = await getProject(scope.projectId, scope.userId);
    const workspaceId = project?.workspaceId ?? null;
    const availablePolicies = workspaceId ? await listPolicies(workspaceId) : [];
    const routePolicyBindings = workspaceId
      ? await listPolicyBindingsByTarget("route", params.routeId, workspaceId)
      : [];
    const routeStepLinks = await listRouteStepEdges(params.routeId, scope.projectId, scope.userId);
    const stepPolicyBindings =
      workspaceId && result.steps.length > 0
        ? await Promise.all(
            result.steps.map(async (s) => {
              const bindings = await listPolicyBindingsByTarget("route_step", s.id, workspaceId);
              return {
                stepId: s.id,
                bindings: bindings.map((b) => ({
                  id: b.id,
                  policyId: b.policyId,
                  policyName: b.policy?.name ?? "Policy",
                  policyType: b.policy?.type ?? "unknown",
                })),
              };
            })
          )
        : [];
    await ensureModelCatalogSynced().catch((e) => {
      console.warn(
        "[connect] model catalog sync skipped:",
        e instanceof Error ? e.message.slice(0, 120) : String(e),
      );
    });
    let modelRows = await listModels({ limit: 500 });
    const recommendedModelIds = recommendedModelIdsForIngestionStage(result.route.stage);
    if (result.route.workload === INGESTION_WORKLOAD && recommendedModelIds.length > 0) {
      const known = new Set(modelRows.map((m) => m.id));
      const missing = recommendedModelIds.filter((id) => !known.has(id));
      if (missing.length > 0) {
        const extras = await Promise.all(missing.map((id) => getModel(id)));
        modelRows = [...modelRows, ...extras.filter((m): m is NonNullable<typeof m> => m != null)];
      }
    }
    const variantRows =
      modelRows.length > 0 ? await listProviderModelVariantsByModelIds(modelRows.map((m) => m.id)) : [];
    const modelCatalog = modelRows.map((m) => ({ id: m.id, name: m.canonicalName }));
    const modelIdsByProvider = buildModelIdsByProvider(modelRows, variantRows);
    if (result.route.workload === INGESTION_WORKLOAD) {
      enrichIngestionRouteBuilderCatalog({
        modelIdsByProvider,
        modelCatalog,
        modelRows,
        variantRows,
      });
    }
    return {
      project: project ? { id: project.id, name: project.name } : null,
      route: result.route,
      ingestionWorkload: INGESTION_WORKLOAD,
      ingestionStageIds: [...INGESTION_STAGE_IDS],
      steps: result.steps,
      modelLifecycleWarnings,
      availablePolicies: availablePolicies.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
      })),
      routePolicyBindings: routePolicyBindings.map((b) => ({
        id: b.id,
        policyId: b.policyId,
        policyName: b.policy?.name ?? "Policy",
        policyType: b.policy?.type ?? "unknown",
      })),
      routeStepLinks: routeStepLinks.map((e) => ({
        id: e.id,
        fromStepId: e.fromStepId,
        toStepId: e.toStepId,
        priority: e.priority,
        label: e.label ?? null,
      })),
      stepPolicyBindings,
      modelOptions: modelRows.map((m) => m.id),
      modelCatalog,
      modelIdsByProvider,
      recommendedModelIds:
        result.route.workload === INGESTION_WORKLOAD ? recommendedModelIds : [],
      catalogSeedVersion: getModelCatalogSeedVersion(),
      error: null,
    };
  } catch (e) {
    console.error("[projects/[id]/routes/[routeId]] load failed:", e);
    return {
      project: null,
      route: null,
      steps: [],
      modelLifecycleWarnings: [],
      availablePolicies: [],
      routePolicyBindings: [],
      routeStepLinks: [],
      stepPolicyBindings: [],
      modelOptions: [],
      modelCatalog: [],
      modelIdsByProvider: {},
      recommendedModelIds: [] as string[],
      catalogSeedVersion: getModelCatalogSeedVersion(),
      ingestionWorkload: INGESTION_WORKLOAD,
      ingestionStageIds: [...INGESTION_STAGE_IDS],
      error: "Unable to load route",
    };
  }
};
