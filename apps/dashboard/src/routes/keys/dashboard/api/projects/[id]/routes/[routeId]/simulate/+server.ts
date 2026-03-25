import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveRouteForExecution } from "$lib/server/route-resolver";
import { canonicalApiToPolicyProvider, normalizeProviderToCanonicalApi } from "$lib/server/canonical-provider";
import { buildResolveSuccessData } from "$lib/server/resolve-response";
import { defaultProviders, estimateCost, type ProviderDefinition } from "@restormel/keys";
import { getProjectInWorkspace } from "$lib/server/db";

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
