import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveRouteForExecution } from "$lib/server/route-resolver";
import { defaultProviders, estimateCost, type ProviderDefinition } from "@restormel/keys";
import { getProjectInWorkspace } from "$lib/server/db";

function projectIdAndUid(
  locals: App.Locals,
  projectId: string
): Promise<{ projectId: string; userId: string } | null> | null {
  // For this endpoint we only need ownership to read routes/steps.
  // We keep the auth logic aligned with the other control-plane endpoints.
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key") {
    if (locals.user.projectIdForKey !== projectId) return Promise.resolve(null);
    return Promise.resolve({ projectId, userId: locals.user.uid });
  }
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    return getProjectInWorkspace(projectId, locals.user.workspaceId).then((p) =>
      p ? { projectId, userId: p.userId } : null
    );
  }
  return Promise.resolve({ projectId, userId: locals.user.uid });
}

function computeCostUsd(args: {
  modelId: string;
  providerPreference: string | null;
  estimatedInputTokens?: number;
}): number | null {
  const { modelId, providerPreference, estimatedInputTokens } = args;
  if (estimatedInputTokens == null || !Number.isFinite(estimatedInputTokens) || estimatedInputTokens <= 0) return null;

  const providers: ProviderDefinition[] = providerPreference
    ? defaultProviders.filter((p) => p.id === providerPreference)
    : defaultProviders;

  const est = estimateCost(modelId, providers);
  if (!est || est.inputPerMillion == null || est.outputPerMillion == null) return null;

  const million = estimatedInputTokens / 1_000_000;
  // Minimal approximation: treat input and output tokens as the same magnitude.
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

    const resolved = await resolveRouteForExecution(scope.projectId, environmentId, scope.userId, {
      routeId: params.routeId,
      stage: typeof body.stage === "string" ? body.stage.trim() : undefined,
      workload: typeof body.workload === "string" ? body.workload.trim() : undefined,
      attemptNumber,
      failureKind: typeof body.failureKind === "string" ? body.failureKind.trim() : undefined,
      previousFailure,
    });

    if (!resolved) return json({ error: "no_route" }, { status: 404 });

    const selectedStepId = resolved.selectedStepId ?? null;
    const perStepEstimates = resolved.steps.map((s) => {
      const costUsd = s.modelId
        ? computeCostUsd({
            modelId: s.modelId,
            providerPreference: s.providerPreference ?? null,
            estimatedInputTokens: body.estimatedInputTokens,
          })
        : null;

      return {
        stepId: s.id,
        orderIndex: s.orderIndex,
        providerType: s.providerPreference ?? null,
        modelId: s.modelId ?? null,
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

    return json({
      data: {
        selectedStepId,
        estimatedCostUsd: selectedEstimate?.estimatedCostUsd ?? null,
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

