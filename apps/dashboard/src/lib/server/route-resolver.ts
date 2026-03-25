/**
 * Route resolution for request execution: project + environment → route → step → provider/model.
 * Used by the execution API after Gateway Key auth. Does not depend on packages/core.
 * Policy enforcement: first enabled step with no policy violations is selected; if all are blocked, returns policyViolations.
 */
import {
  getProject,
  getOrCreateDefaultWorkspace,
  listRoutes,
  getRoute,
  getRouteWithSteps,
  evaluatePolicies,
  getModelsLifecycleByIds,
  type RouteRecord,
  type RouteStepRecord,
  type PolicyViolation,
} from "$lib/server/db";

export type ResolvedRouteResult = {
  workspaceId: string;
  projectId: string;
  environmentId: string;
  route: RouteRecord;
  steps: RouteStepRecord[];
  /** First enabled step that passes policy, or null if none or all blocked. */
  selectedStep: RouteStepRecord | null;
  /** Machine-readable selected step details for stage-aware switch UIs. */
  selectedStepId?: string | null;
  selectedOrderIndex?: number | null;
  switchReasonCode?: string | null;
  /** Provider type from selected step (provider_preference) or null. */
  providerType: string | null;
  /** Model id from selected step or route default. */
  modelId: string | null;
  /** Explanation for logging/audit. */
  explanation: string;
  /** Criteria that matched on selected step (switchCriteria snapshot). */
  matchedCriteria?: Record<string, unknown> | null;
  /** Ordered candidates considered after selected step. */
  fallbackCandidates?: Array<{
    stepId: string;
    orderIndex: number;
    providerType: string | null;
    modelId: string | null;
    enabled: boolean;
  }>;
  /** Set when there were enabled steps but all were blocked by policy (selectedStep is null). */
  policyViolations?: PolicyViolation[];
};

export type ResolveRouteFailureCode =
  | "no_route"
  | "route_unpublished"
  | "route_disabled"
  | "no_key_available";

export type ResolveRouteFailure = {
  code: ResolveRouteFailureCode;
  routeId?: string;
  message?: string;
};

export type ResolveRouteOutcome =
  | { ok: true; result: ResolvedRouteResult }
  | { ok: false; failure: ResolveRouteFailure };

export function isRoutePublished(route: RouteRecord): boolean {
  const v = route.version ?? 1;
  const p = route.publishedVersion ?? 1;
  return v === p;
}

function isNullStage(stage: string | null | undefined): boolean {
  return stage == null || String(stage).trim() === "";
}

async function findRouteByIdOrName(
  projectId: string,
  userId: string,
  routeIdOrName: string
): Promise<RouteRecord | null> {
  const trimmed = routeIdOrName.trim();
  if (!trimmed) return null;
  const byId = await getRoute(trimmed, projectId, userId);
  if (byId) return byId;
  const inProject = await listRoutes(projectId, userId);
  return inProject.find((r) => r.name === trimmed) ?? null;
}

/** Failure ordering when routeId is explicit: wrong env / missing → no_route before lifecycle checks. */
function classifyRouteForExplicitId(route: RouteRecord, environmentId: string): ResolveRouteFailure | null {
  if (route.environmentId !== environmentId) {
    return { code: "no_route", message: "Route is not bound to this environment" };
  }
  if (route.status !== "active") {
    return { code: "route_disabled", routeId: route.id, message: "Route is not active" };
  }
  if (route.enabled === false) {
    return { code: "route_disabled", routeId: route.id, message: "Route is disabled" };
  }
  if (!isRoutePublished(route)) {
    return { code: "route_unpublished", routeId: route.id, message: "Route has no published version" };
  }
  return null;
}

/**
 * Pick a published, active, enabled route for metadata-based discovery (no routeId).
 * SOPHIA ingestion: dedicated `workload=ingestion` + `stage=ingestion_<sub>` then shared `workload=ingestion` + null stage.
 */
async function selectRouteForDiscovery(
  projectId: string,
  userId: string,
  environmentId: string,
  workload?: string | null,
  stage?: string | null
): Promise<RouteRecord | null> {
  const wl = workload?.trim() || undefined;
  const st = stage?.trim() || undefined;

  const isSelectable = (r: RouteRecord) =>
    r.status === "active" &&
    (r.enabled ?? true) &&
    isRoutePublished(r) &&
    r.environmentId === environmentId;

  if (wl && st) {
    const dedicated = await listRoutes(projectId, userId, {
      environmentId,
      workload: wl,
      stage: st,
    });
    const d = dedicated.find(isSelectable);
    if (d) return d;
    const forWorkload = await listRoutes(projectId, userId, { environmentId, workload: wl });
    const shared = forWorkload.find((r) => isSelectable(r) && isNullStage(r.stage));
    return shared ?? null;
  }

  if (wl && !st) {
    const forWorkload = await listRoutes(projectId, userId, { environmentId, workload: wl });
    return forWorkload.find((r) => isSelectable(r) && isNullStage(r.stage)) ?? null;
  }

  if (!wl && st) {
    const forStage = await listRoutes(projectId, userId, { environmentId, stage: st });
    return forStage.find(isSelectable) ?? null;
  }

  const allInEnv = await listRoutes(projectId, userId, { environmentId });
  return allInEnv.find(isSelectable) ?? null;
}

/**
 * Resolve route and provider/model for a request. Uses first matching published route for the environment,
 * then first enabled step. Provider = step.providerPreference, model = step.modelId ?? route.defaultModelId.
 * Caller must have already verified project access (e.g. gateway key or session).
 */
export async function resolveRouteForExecution(
  projectId: string,
  environmentId: string,
  userId: string,
  options?: {
    routeId?: string;
    stage?: string | null;
    workload?: string | null;
    task?: string | null;
    attemptNumber?: number;
    previousFailure?: { selectedOrderIndex?: number | null; selectedStepId?: string | null };
    failureKind?: string | null;
  }
): Promise<ResolveRouteOutcome> {
  const project = await getProject(projectId, userId);
  if (!project) {
    return { ok: false, failure: { code: "no_route", message: "Project not found" } };
  }

  const workspaceId =
    project.workspaceId ?? (await getOrCreateDefaultWorkspace(project.userId)).id;

  const routeIdOpt = options?.routeId?.trim();

  let route: RouteRecord | null = null;

  if (routeIdOpt) {
    route = await findRouteByIdOrName(projectId, userId, routeIdOpt);
    if (!route) {
      return { ok: false, failure: { code: "no_route", message: "No route matched routeId" } };
    }
    const life = classifyRouteForExplicitId(route, environmentId);
    if (life) {
      return { ok: false, failure: life };
    }
  } else {
    route = await selectRouteForDiscovery(
      projectId,
      userId,
      environmentId,
      options?.workload ?? undefined,
      options?.stage ?? undefined
    );
    if (!route) {
      return { ok: false, failure: { code: "no_route", message: "No published route matched constraints" } };
    }
  }

  const withSteps = await getRouteWithSteps(route.id, projectId, userId);
  if (!withSteps) {
    return { ok: false, failure: { code: "no_route", routeId: route.id, message: "Route not found" } };
  }

  const { route: routeRecord, steps } = withSteps;
  const enabledSteps = steps
    .filter((s) => s.enabled)
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const attemptNumber = options?.attemptNumber ?? 0;
  const startAfterOrderIndex = attemptNumber > 0
    ? options?.previousFailure?.selectedOrderIndex ?? -1
    : -1;

  const modelIds = [
    ...new Set([
      ...enabledSteps.map((s) => s.modelId).filter(Boolean),
      routeRecord.defaultModelId,
    ].filter(Boolean) as string[]),
  ];
  const lifecycleByModel = new Map(
    (await getModelsLifecycleByIds(modelIds)).map((m) => [m.id, m.lifecycleState ?? undefined])
  );

  const allViolations: PolicyViolation[] = [];
  for (const step of enabledSteps) {
    if (attemptNumber > 0 && step.orderIndex <= startAfterOrderIndex) continue;

    const providerType = step.providerPreference ?? null;
    const modelId = step.modelId ?? routeRecord.defaultModelId ?? null;
    const lifecycleState = modelId ? lifecycleByModel.get(modelId) : undefined;

    const violations = await evaluatePolicies({
      workspaceId,
      projectId,
      environmentId,
      routeId: routeRecord.id,
      modelId: modelId ?? undefined,
      providerType: providerType ?? undefined,
      modelLifecycleState: lifecycleState,
    });
    if (violations.length === 0) {
      const explanation = `route=${routeRecord.id} step=${step.orderIndex} provider=${providerType ?? "—"} model=${modelId ?? "—"}`;
      return {
        ok: true,
        result: {
          workspaceId,
          projectId,
          environmentId,
          route: routeRecord,
          steps,
          selectedStep: step,
          selectedStepId: step.id,
          selectedOrderIndex: step.orderIndex,
          switchReasonCode:
            attemptNumber > 0
              ? options?.failureKind ?? "switched_after_previous_failure"
              : "initial_selection",
          providerType,
          modelId,
          explanation,
          matchedCriteria: step.switchCriteria ?? null,
          fallbackCandidates: enabledSteps
            .filter((s) => s.orderIndex > step.orderIndex)
            .map((s) => ({
              stepId: s.id,
              orderIndex: s.orderIndex,
              providerType: s.providerPreference ?? null,
              modelId: s.modelId ?? routeRecord.defaultModelId ?? null,
              enabled: s.enabled,
            })),
        },
      };
    }
    allViolations.push(...violations);
  }

  const selectedStep = null;
  const providerType = null;
  const modelId = null;
  const switchReasonCode =
    attemptNumber > 0 && options?.failureKind ? options.failureKind : null;
  const explanation = enabledSteps.length > 0
    ? `route=${routeRecord.id} all_steps_blocked_by_policy`
    : `route=${routeRecord.id} no_enabled_step default_model=${routeRecord.defaultModelId ?? "—"}`;

  if (enabledSteps.length > 0) {
    return {
      ok: true,
      result: {
        workspaceId,
        projectId,
        environmentId,
        route: routeRecord,
        steps,
        selectedStep,
        selectedStepId: null,
        selectedOrderIndex: null,
        switchReasonCode,
        providerType,
        modelId,
        explanation,
        matchedCriteria: null,
        fallbackCandidates: [],
        policyViolations: allViolations,
      },
    };
  }

  return {
    ok: false,
    failure: {
      code: "no_key_available",
      routeId: routeRecord.id,
      message: "No enabled route step available to resolve provider/model",
    },
  };
}

export type ValidateBindingInput = {
  environmentId: string;
  workload?: string | null;
  stage?: string | null;
  task?: string | null;
};

/**
 * Preflight: same eligibility as resolve (env, published, enabled, metadata match when provided).
 * Does not run policy evaluation on steps.
 */
export async function validateRouteBinding(
  projectId: string,
  userId: string,
  routeId: string,
  input: ValidateBindingInput
): Promise<{ ok: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const route = await findRouteByIdOrName(projectId, userId, routeId);
  if (!route) {
    return { ok: false, reasons: ["route_not_found"] };
  }
  if (route.environmentId !== input.environmentId.trim()) {
    reasons.push("environment_mismatch");
  }
  if (route.status !== "active") {
    reasons.push("route_inactive");
  }
  if (route.enabled === false) {
    reasons.push("route_disabled");
  }
  if (!isRoutePublished(route)) {
    reasons.push("route_unpublished");
  }

  const wl = input.workload?.trim();
  const st = input.stage?.trim();
  if (wl || st) {
    if (wl && route.workload !== wl) {
      reasons.push("workload_mismatch");
    }
    if (wl && st) {
      const dedicatedMatch = route.workload === wl && route.stage === st;
      const sharedFallbackMatch = route.workload === wl && isNullStage(route.stage);
      if (!dedicatedMatch && !sharedFallbackMatch) {
        reasons.push("ingestion_metadata_mismatch");
      }
    } else if (wl && !st) {
      if (route.workload !== wl || !isNullStage(route.stage)) {
        reasons.push("expected_shared_route_null_stage");
      }
    } else if (!wl && st) {
      if (route.stage !== st) {
        reasons.push("stage_mismatch");
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}
