/**
 * Route resolution for request execution: project + environment → route → step → provider/model.
 * Used by the execution API after Gateway Key auth. Does not depend on packages/core.
 * Policy enforcement: first enabled step with no policy violations is selected; if all are blocked, returns policyViolations.
 */
import {
  getProject,
  getOrCreateDefaultWorkspace,
  listRoutes,
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
  /** Set when there were enabled steps but all were blocked by policy (selectedStep is null). */
  policyViolations?: PolicyViolation[];
};

/**
 * Resolve route and provider/model for a request. Uses first active route for the environment,
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
    attemptNumber?: number;
    previousFailure?: { selectedOrderIndex?: number | null; selectedStepId?: string | null };
    failureKind?: string | null;
  }
): Promise<ResolvedRouteResult | null> {
  const project = await getProject(projectId, userId);
  if (!project) return null;

  const workspaceId =
    project.workspaceId ?? (await getOrCreateDefaultWorkspace(project.userId)).id;
  const routes = await listRoutes(projectId, userId, {
    environmentId,
    stage: options?.stage ?? undefined,
    workload: options?.workload ?? undefined,
  });
  const activeRoutes = routes.filter((r) => r.status === "active" && (r.enabled ?? true));

  const route =
    options?.routeId
      ? activeRoutes.find((r) => r.id === options.routeId || r.name === options.routeId) ?? activeRoutes[0]
      : options?.stage
        ? activeRoutes.find(
            (r) =>
              r.stage === options.stage &&
              (options.workload ? r.workload === options.workload : true)
          ) ?? null
        : activeRoutes[0];
  if (!route) {
    return null;
  }

  const withSteps = await getRouteWithSteps(route.id, projectId, userId);
  if (!withSteps) return null;

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
    // Minimal stage-aware switch behavior: on later attempts, skip steps at or before
    // the previous selected orderIndex (if provided by the caller).
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
            : null,
        providerType,
        modelId,
        explanation,
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

  return {
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
    ...(enabledSteps.length > 0 ? { policyViolations: allViolations } : {}),
  };
}
