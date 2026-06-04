import type { PageServerLoad } from "./$types";
import {
  getProject,
  getProjectInWorkspace,
  getRouteWithSteps,
  getModelsLifecycleByIds,
  listPolicies,
  listPolicyBindingsByTarget,
  listModels,
  listProviderModelVariantsByModelIds,
  listRouteStepEdges,
} from "$lib/server/db";
import { INGESTION_STAGE_IDS, INGESTION_WORKLOAD } from "$lib/server/ingestion-routing";
import { expandPoolMembersFromStep } from "$lib/server/model-pool";
import { ROUTE_STEP_PROVIDER_OPTIONS } from "$lib/route-step-providers";

function variantServesProvider(
  v: {
    modelId: string;
    providerIntegrationType: string;
    catalogProviderId: string | null;
    availabilityStatus: string | null;
  },
  pref: string
): boolean {
  const status = (v.availabilityStatus ?? "").toLowerCase();
  if (status === "unavailable") return false;
  const p = pref.trim().toLowerCase();
  const t = (v.providerIntegrationType ?? "").trim().toLowerCase();
  const c = (v.catalogProviderId ?? "").trim().toLowerCase();
  return t === p || (Boolean(c) && c === p);
}

function buildModelIdsByProvider(
  modelRows: { id: string; canonicalName: string }[],
  variantRows: Awaited<ReturnType<typeof listProviderModelVariantsByModelIds>>
): Record<string, string[]> {
  const modelIdsByProvider: Record<string, string[]> = {};
  for (const k of ROUTE_STEP_PROVIDER_OPTIONS) modelIdsByProvider[k] = [];
  const nameById = new Map(modelRows.map((m) => [m.id, m.canonicalName]));
  for (const m of modelRows) {
    const mv = variantRows.filter((v) => v.modelId === m.id);
    for (const pref of ROUTE_STEP_PROVIDER_OPTIONS) {
      if (mv.some((v) => variantServesProvider(v, pref))) {
        modelIdsByProvider[pref].push(m.id);
      }
    }
  }
  for (const pref of ROUTE_STEP_PROVIDER_OPTIONS) {
    modelIdsByProvider[pref].sort((a, b) =>
      (nameById.get(a) ?? a).localeCompare(nameById.get(b) ?? b, undefined, { sensitivity: "base" })
    );
  }
  return modelIdsByProvider;
}

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
    const modelRows = await listModels({ limit: 250 });
    const variantRows =
      modelRows.length > 0 ? await listProviderModelVariantsByModelIds(modelRows.map((m) => m.id)) : [];
    const modelIdsByProvider = buildModelIdsByProvider(modelRows, variantRows);
    const modelCatalog = modelRows.map((m) => ({ id: m.id, name: m.canonicalName }));
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
      ingestionWorkload: INGESTION_WORKLOAD,
      ingestionStageIds: [...INGESTION_STAGE_IDS],
      error: "Unable to load route",
    };
  }
};
