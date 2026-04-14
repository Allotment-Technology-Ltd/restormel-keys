import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveRouteForExecution, selectExecutableMemberForStep } from "$lib/server/route-resolver";
import { canonicalApiToPolicyProvider, normalizeProviderToCanonicalApi } from "$lib/server/canonical-provider";
import { buildResolveSuccessData } from "$lib/server/resolve-response";
import { defaultProviders, estimateCost, type ProviderDefinition } from "@restormel/keys";
import { expandPoolMembersFromStep } from "$lib/server/model-pool";
import {
  getModelsLifecycleByIds,
  getProjectInWorkspace,
  listRouteStepEdges,
  type PolicyViolation,
  type RouteStepRecord,
} from "$lib/server/db";
import { computeEnabledStepOrderForGraph } from "$lib/server/route-order-graph";
import {
  getAdvanceOnAllowlist,
  hostedSwitchAdvanceMatrix,
  RUNTIME_SWITCH_EVAL_VERSION,
} from "$lib/server/runtime-switch-eval";

async function projectIdAndUid(
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
  return { projectId, userId: locals.user.uid };
}

type SimulateHypotheticalOutcome = "selected" | "blocked_by_policy" | "not_executable" | "not_selected";

function buildHypotheticalRoutingAttempts(
  enabledOrdered: RouteStepRecord[],
  selectedStepId: string | null,
  routeDefaultModelId: string | null,
  diagnostics: Array<{
    stepId: string;
    orderIndex: number;
    providerType: string | null;
    modelId: string | null;
    policyViolations: PolicyViolation[];
    executable: boolean;
    parallelGroupId?: string | null;
    parallelBranchRole?: string | null;
  }>
): Array<{
  stepId: string;
  orderIndex: number;
  providerType: string | null;
  modelId: string | null;
  hypotheticalOutcome: SimulateHypotheticalOutcome;
  parallelGroupId?: string | null;
  parallelBranchRole?: string | null;
}> {
  return enabledOrdered.map((s) => {
    const diag = diagnostics.find((d) => d.stepId === s.id);
    const mid = diag?.modelId ?? s.modelId ?? routeDefaultModelId;
    const canonical = diag?.providerType ?? normalizeProviderToCanonicalApi(s.providerPreference);
    const parallelGroupId = s.parallelGroupId ?? null;
    const parallelBranchRole = s.parallelBranchRole ?? null;
    if (selectedStepId === s.id) {
      return {
        stepId: s.id,
        orderIndex: s.orderIndex,
        providerType: canonical,
        modelId: mid,
        hypotheticalOutcome: "selected" as const,
        parallelGroupId,
        parallelBranchRole,
      };
    }
    if (!diag) {
      return {
        stepId: s.id,
        orderIndex: s.orderIndex,
        providerType: canonical,
        modelId: mid,
        hypotheticalOutcome: "not_selected" as const,
        parallelGroupId,
        parallelBranchRole,
      };
    }
    if (diag.policyViolations.length > 0) {
      return {
        stepId: s.id,
        orderIndex: s.orderIndex,
        providerType: canonical,
        modelId: mid,
        hypotheticalOutcome: "blocked_by_policy" as const,
        parallelGroupId,
        parallelBranchRole,
      };
    }
    if (!diag.executable) {
      return {
        stepId: s.id,
        orderIndex: s.orderIndex,
        providerType: canonical,
        modelId: mid,
        hypotheticalOutcome: "not_executable" as const,
        parallelGroupId,
        parallelBranchRole,
      };
    }
    return {
      stepId: s.id,
      orderIndex: s.orderIndex,
      providerType: canonical,
      modelId: mid,
      hypotheticalOutcome: "not_selected" as const,
      parallelGroupId,
      parallelBranchRole,
    };
  });
}

function computeCostUsd(args: {
  modelId: string;
  canonicalProvider: string | null;
  estimatedInputTokens?: number;
}): number | null {
  const { modelId, canonicalProvider, estimatedInputTokens } = args;
  if (estimatedInputTokens == null || !Number.isFinite(estimatedInputTokens) || estimatedInputTokens <= 0) return null;

  const forCost = canonicalApiToPolicyProvider(canonicalProvider ?? undefined) ?? canonicalProvider ?? null;
  const providers: ProviderDefinition[] = forCost
    ? defaultProviders.filter((p) => p.id === forCost)
    : defaultProviders;

  const est = estimateCost(modelId, providers);
  if (!est || est.inputPerMillion == null || est.outputPerMillion == null) return null;

  const million = estimatedInputTokens / 1_000_000;
  return million * (est.inputPerMillion + est.outputPerMillion);
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectIdAndUid(locals, params.id);
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    let body: {
      environmentId?: string;
      stage?: string;
      workload?: string;
      attemptNumber?: number;
      failureKind?: string;
      previousFailure?: { selectedOrderIndex?: number; selectedStepId?: string };
      estimatedInputTokens?: number;
      estimatedInputChars?: number;
      traceId?: string;
      /** When true (default), response includes `stepDiagnostics` (policy + executable probe per enabled step). */
      includeStepDiagnostics?: boolean;
      /** When true, response includes `routingAttempts` (hypothetical tier outcomes for this dry-run; no LLM calls). Implies internal policy evaluation even if `includeStepDiagnostics` is false. */
      includeRoutingAttempts?: boolean;
      /** When true, response includes `hostedRuntimeSwitch` (Phase 3 advance matrix aligned with POST …/runtime/invoke). */
      includeHostedSwitchEvaluation?: boolean;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }

    const environmentId = typeof body.environmentId === "string" ? body.environmentId.trim() : "";
    if (!environmentId) return json({ error: "environmentId is required" }, { status: 400 });

    const attemptNumber =
      typeof body.attemptNumber === "number" && Number.isInteger(body.attemptNumber) && body.attemptNumber >= 0
        ? body.attemptNumber
        : 0;

    const previousFailure =
      body.previousFailure && typeof body.previousFailure === "object"
        ? {
            selectedOrderIndex:
              typeof body.previousFailure.selectedOrderIndex === "number" &&
              Number.isFinite(body.previousFailure.selectedOrderIndex)
                ? body.previousFailure.selectedOrderIndex
                : undefined,
            selectedStepId:
              typeof body.previousFailure.selectedStepId === "string"
                ? body.previousFailure.selectedStepId.trim() || undefined
                : undefined,
          }
        : undefined;

    const outcome = await resolveRouteForExecution(scope.projectId, environmentId, scope.userId, {
      routeId: params.routeId,
      stage: typeof body.stage === "string" ? body.stage.trim() : undefined,
      workload: typeof body.workload === "string" ? body.workload.trim() : undefined,
      attemptNumber,
      failureKind: typeof body.failureKind === "string" ? body.failureKind.trim() : undefined,
      previousFailure,
    });

    if (!outcome.ok) {
      const st =
        outcome.failure.code === "route_unpublished"
          ? 409
          : outcome.failure.code === "route_disabled"
            ? 403
            : outcome.failure.code === "no_key_available" || outcome.failure.code === "resolve_incomplete"
              ? 422
              : 404;
      return json(
        {
          error: outcome.failure.code,
          message: outcome.failure.message ?? outcome.failure.code,
          ...(outcome.failure.code === "resolve_incomplete"
            ? {
                userMessage:
                  "This route step is missing a provider or model. Set provider and model on the step (or a route default model) in the dashboard.",
              }
            : {}),
          ...(outcome.failure.routeId ? { routeId: outcome.failure.routeId } : {}),
        },
        { status: st }
      );
    }

    const resolved = outcome.result;

    if (resolved.policyViolations && resolved.policyViolations.length > 0) {
      return json(
        {
          error: "policy_blocked",
          message: "All route steps were blocked by policy",
          violations: resolved.policyViolations,
        },
        { status: 403 }
      );
    }

    const selectedStepId = resolved.selectedStepId ?? null;
    const includeStepDiagnostics = body.includeStepDiagnostics !== false;
    const includeRoutingAttempts = body.includeRoutingAttempts === true;

    const graphEdges = await listRouteStepEdges(params.routeId, scope.projectId, scope.userId);
    const edgeInputs = graphEdges.map((e) => ({
      fromStepId: e.fromStepId,
      toStepId: e.toStepId,
      priority: e.priority,
    }));
    const enabledOrdered =
      edgeInputs.length > 0
        ? computeEnabledStepOrderForGraph(resolved.steps, edgeInputs, resolved.route.entryStepId ?? null)
        : [...resolved.steps]
            .filter((s) => s.enabled)
            .sort((a, b) => a.orderIndex - b.orderIndex);

    const workspaceId = resolved.workspaceId;
    const projectId = resolved.projectId;
    const resolvedEnvironmentId = resolved.environmentId;
    const routeId = resolved.route.id;
    const seed = `${projectId}:${routeId}:${resolvedEnvironmentId}:${attemptNumber}`;

    const modelIdSet = new Set<string>();
    if (resolved.route.defaultModelId) modelIdSet.add(resolved.route.defaultModelId);
    for (const s of enabledOrdered) {
      const { candidates } = expandPoolMembersFromStep(s, resolved.route.defaultModelId ?? null);
      for (const c of candidates) {
        if (c.modelId) modelIdSet.add(c.modelId);
      }
    }
    const lifecycleRows = await getModelsLifecycleByIds([...modelIdSet]);
    const lifecycleByModel = new Map(lifecycleRows.map((x) => [x.id, x.lifecycleState ?? undefined]));

    const poolEvalResults = await Promise.all(
      enabledOrdered.map(async (s) => ({
        step: s,
        picked: await selectExecutableMemberForStep(
          s,
          resolved.route,
          workspaceId,
          resolvedEnvironmentId,
          routeId,
          lifecycleByModel,
          seed,
          attemptNumber
        ),
      }))
    );

    const diagRows = poolEvalResults.map(({ step, picked }) => {
      if (picked.ok) {
        return {
          stepId: step.id,
          orderIndex: step.orderIndex,
          providerType: picked.canonicalProvider,
          modelId: picked.modelId,
          policyViolations: [] as PolicyViolation[],
          executable: true,
          parallelGroupId: step.parallelGroupId ?? null,
          parallelBranchRole: step.parallelBranchRole ?? null,
        };
      }
      return {
        stepId: step.id,
        orderIndex: step.orderIndex,
        providerType: normalizeProviderToCanonicalApi(step.providerPreference),
        modelId: step.modelId ?? resolved.route.defaultModelId ?? null,
        policyViolations: picked.policyViolations,
        executable: false,
        parallelGroupId: step.parallelGroupId ?? null,
        parallelBranchRole: step.parallelBranchRole ?? null,
      };
    });

    let stepDiagnostics: typeof diagRows = [];
    if (includeStepDiagnostics) {
      stepDiagnostics = diagRows;
    }

    const routingAttempts =
      includeRoutingAttempts && diagRows.length > 0
        ? buildHypotheticalRoutingAttempts(
            enabledOrdered,
            selectedStepId,
            resolved.route.defaultModelId ?? null,
            diagRows
          )
        : includeRoutingAttempts
          ? []
          : undefined;

    const diagByStepId = new Map(diagRows.map((d) => [d.stepId, d]));
    const perStepEstimates = resolved.steps.map((s) => {
      const diag = s.enabled ? diagByStepId.get(s.id) : undefined;
      const canonical =
        diag?.providerType ?? normalizeProviderToCanonicalApi(s.providerPreference);
      const mid = diag?.modelId ?? s.modelId ?? resolved.route.defaultModelId ?? null;
      const costUsd =
        mid && typeof mid === "string"
          ? computeCostUsd({
              modelId: mid,
              canonicalProvider: canonical,
              estimatedInputTokens: body.estimatedInputTokens,
            })
          : null;

      return {
        stepId: s.id,
        orderIndex: s.orderIndex,
        providerType: canonical,
        modelId: mid,
        estimatedCostUsd: costUsd,
        parallelGroupId: s.parallelGroupId ?? null,
        parallelBranchRole: s.parallelBranchRole ?? null,
        wouldRun: selectedStepId === s.id,
        wouldBeSkippedBecause: !s.enabled
          ? "disabled"
          : selectedStepId !== s.id
            ? "not_selected"
            : null,
      };
    });

    const selectedEstimate = perStepEstimates.find((e) => e.stepId === selectedStepId);
    const estimatedCostUsd = selectedEstimate?.estimatedCostUsd ?? null;

    const base = buildResolveSuccessData({
      resolved,
      traceId: typeof body.traceId === "string" ? body.traceId : null,
      estimatedCostUsd,
    });

    const includeHostedSwitchEvaluation = body.includeHostedSwitchEvaluation === true;
    const hostedRuntimeSwitch = includeHostedSwitchEvaluation
      ? {
          runtimeSwitchEvalVersion: RUNTIME_SWITCH_EVAL_VERSION,
          advanceOnAllowlist: [...getAdvanceOnAllowlist()],
          hostedPipelineSteps: enabledOrdered.map((s) => ({
            stepId: s.id,
            orderIndex: s.orderIndex,
            fallbackOn: s.fallbackOn ?? null,
            advanceIfFailureKind: hostedSwitchAdvanceMatrix(s),
          })),
        }
      : undefined;

    return json({
      data: {
        ...base,
        perStepEstimates,
        ...(includeStepDiagnostics ? { stepDiagnostics } : {}),
        ...(routingAttempts !== undefined ? { routingAttempts } : {}),
        ...(hostedRuntimeSwitch ? { hostedRuntimeSwitch } : {}),
        wouldRun: selectedStepId != null,
        switchOutcomePreview: {
          attemptNumber,
          failureKind: typeof body.failureKind === "string" ? body.failureKind.trim() : null,
          selectedOrderIndex: resolved.selectedOrderIndex ?? null,
        },
      },
    });
  } catch (e) {
    console.error("[route.simulate.post] internal error:", e);
    return json({ error: "internal_error", detail: "route_simulate_failed" }, { status: 500 });
  }
};
