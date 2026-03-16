/**
 * Route resolution for request execution: project + environment → route → step → provider/model.
 * Used by the execution API after Gateway Key auth. Does not depend on packages/core.
 */
import {
  getProject,
  getOrCreateDefaultWorkspace,
  listRoutes,
  getRouteWithSteps,
  type RouteRecord,
  type RouteStepRecord,
} from "$lib/server/db";

export type ResolvedRouteResult = {
  workspaceId: string;
  projectId: string;
  environmentId: string;
  route: RouteRecord;
  steps: RouteStepRecord[];
  /** First enabled step, or null if none. */
  selectedStep: RouteStepRecord | null;
  /** Provider type from selected step (provider_preference) or null. */
  providerType: string | null;
  /** Model id from selected step or route default. */
  modelId: string | null;
  /** Explanation for logging/audit. */
  explanation: string;
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
  options?: { routeId?: string }
): Promise<ResolvedRouteResult | null> {
  const project = await getProject(projectId, userId);
  if (!project) return null;

  const workspaceId =
    project.workspaceId ?? (await getOrCreateDefaultWorkspace(project.userId)).id;
  const routes = await listRoutes(projectId, userId, { environmentId });
  const activeRoutes = routes.filter((r) => r.status === "active");
  const route = options?.routeId
    ? activeRoutes.find((r) => r.id === options.routeId) ?? activeRoutes[0]
    : activeRoutes[0];
  if (!route) {
    return null;
  }

  const withSteps = await getRouteWithSteps(route.id, projectId, userId);
  if (!withSteps) return null;

  const { route: routeRecord, steps } = withSteps;
  const enabledSteps = steps.filter((s) => s.enabled);
  const selectedStep = enabledSteps[0] ?? null;
  const providerType = selectedStep?.providerPreference ?? null;
  const modelId = selectedStep?.modelId ?? routeRecord.defaultModelId ?? null;

  const explanation = selectedStep
    ? `route=${routeRecord.id} step=${selectedStep.orderIndex} provider=${providerType ?? "—"} model=${modelId ?? "—"}`
    : `route=${routeRecord.id} no_enabled_step default_model=${routeRecord.defaultModelId ?? "—"}`;

  return {
    workspaceId,
    projectId,
    environmentId,
    route: routeRecord,
    steps,
    selectedStep,
    providerType,
    modelId,
    explanation,
  };
}
