import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveRouteForExecution } from "$lib/server/route-resolver";
import {
  canonicalApiToPolicyProvider,
  isExecutableProviderModelPair,
  normalizeProviderToCanonicalApi,
} from "$lib/server/canonical-provider";
import { buildResolveSuccessData } from "$lib/server/resolve-response";
import { defaultProviders, estimateCost, type ProviderDefinition } from "@restormel/keys";
import {
  evaluatePolicies,
  getModelsLifecycleByIds,
  getProjectInWorkspace,
  type PolicyViolation,
  type RouteStepRecord,
} from "$lib/server/db";

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
  }>
): Array<{
  stepId: string;
  orderIndex: number;
  providerType: string | null;
  modelId: string | null;
  hypotheticalOutcome: SimulateHypotheticalOutcome;
}> {
  return enabledOrdered.map((s) => {
    const diag = diagnostics.find((d) => d.stepId === s.id);
    const mid = s.modelId ?? routeDefaultModelId;
    const canonical = normalizeProviderToCanonicalApi(s.providerPreference);
    if (selectedStepId === s.id) {
      return {
        stepId: s.id,
        orderIndex: s.orderIndex,
        providerType: canonical,
        modelId: mid,
        hypotheticalOutcome: "selected" as const,
      };
    }
    if (!diag) {
      return {
        stepId: s.id,
        orderIndex: s.orderIndex,
        providerType: canonical,
        modelId: mid,
        hypotheticalOutcome: "not_selected" as const,
      };
    }
    if (diag.policyViolations.length > 0) {
      return {
        stepId: s.id,
        orderIndex: s.orderIndex,
        providerType: canonical,
        modelId: mid,
        hypotheticalOutcome: "blocked_by_policy" as const,
      };
    }
    if (!diag.executable) {
      return {
        stepId: s.id,
        orderIndex: s.orderIndex,
        providerType: canonical,
        modelId: mid,
        hypotheticalOutcome: "not_executable" as const,
      };
    }
    return {
      stepId: s.id,
      orderIndex: s.orderIndex,
      providerType: canonical,
      modelId: mid,
      hypotheticalOutcome: "not_selected" as const,
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
    const runStepDiagnostics = includeStepDiagnostics || includeRoutingAttempts;

    const enabledOrdered = [...resolved.steps]
      .filter((s) => s.enabled)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    let stepDiagnostics: Array<{
      stepId: string;
      orderIndex: number;
      providerType: string | null;
      modelId: string | null;
      policyViolations: PolicyViolation[];
      executable: boolean;
    }> = [];

    if (runStepDiagnostics) {
      const workspaceId = resolved.workspaceId;
      const projectId = resolved.projectId;
      const environmentId = resolved.environmentId;
      const routeId = resolved.route.id;
      const lifecycleRows = await getModelsLifecycleByIds(
        [
          ...new Set(
            enabledOrdered
              .map((s) => s.modelId ?? resolved.route.defaultModelId)
              .filter(Boolean) as string[]
          ),
        ]
      );
      const lifecycleByModel = new Map(lifecycleRows.map((x) => [x.id, x.lifecycleState ?? undefined]));
      stepDiagnostics = await Promise.all(
        enabledOrdered.map(async (s) => {
          const mid = s.modelId ?? resolved.route.defaultModelId ?? null;
          const canonical = normalizeProviderToCanonicalApi(s.providerPreference);
          const policyProvider =
            canonicalApiToPolicyProvider(canonical ?? undefined) ??
            (s.providerPreference?.trim() ? s.providerPreference.trim() : undefined);
          const lifecycleState = mid ? lifecycleByModel.get(mid) : undefined;
          const violations = await evaluatePolicies({
            workspaceId,
            projectId,
            environmentId,
            routeId,
            modelId: mid ?? undefined,
            providerType: policyProvider,
            modelLifecycleState: lifecycleState,
          });
          const exec = isExecutableProviderModelPair(s.providerPreference, mid);
          return {
            stepId: s.id,
            orderIndex: s.orderIndex,
            providerType: canonical,
            modelId: mid,
            policyViolations: violations,
            executable: exec.ok,
          };
        })
      );
    }

    const routingAttempts =
      includeRoutingAttempts && stepDiagnostics.length > 0
        ? buildHypotheticalRoutingAttempts(
            enabledOrdered,
            selectedStepId,
            resolved.route.defaultModelId ?? null,
            stepDiagnostics
          )
        : includeRoutingAttempts
          ? []
          : undefined;

    const perStepEstimates = resolved.steps.map((s) => {
      const canonical = normalizeProviderToCanonicalApi(s.providerPreference);
      const mid = s.modelId ?? resolved.route.defaultModelId ?? null;
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

    return json({
      data: {
        ...base,
        perStepEstimates,
        ...(includeStepDiagnostics ? { stepDiagnostics } : {}),
        ...(routingAttempts !== undefined ? { routingAttempts } : {}),
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
