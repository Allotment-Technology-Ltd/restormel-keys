import { DASHBOARD_BASE } from "$lib/dashboard-base";

export type RoutePrimaryModel = {
  modelId: string;
  provider: string;
};

export type ActiveModelMatch = "recommended" | "custom" | "not_configured";

export type StageActiveModelState =
  | { status: "loading" }
  | { status: "resolved"; active: RoutePrimaryModel; match: ActiveModelMatch }
  | { status: "not_configured" }
  | { status: "error" };

export function matchActiveToRecommended(
  active: RoutePrimaryModel | null | undefined,
  recommended: { modelId: string; provider: string } | null | undefined,
): ActiveModelMatch {
  if (!active?.modelId || !active.provider) return "not_configured";
  if (!recommended?.modelId || !recommended.provider) return "custom";
  const modelMatch = active.modelId.trim().toLowerCase() === recommended.modelId.trim().toLowerCase();
  const providerMatch = active.provider.trim().toLowerCase() === recommended.provider.trim().toLowerCase();
  return modelMatch && providerMatch ? "recommended" : "custom";
}

export async function fetchRoutePrimaryModel(
  projectId: string,
  routeId: string,
): Promise<RoutePrimaryModel | null> {
  const res = await fetch(`${DASHBOARD_BASE}/api/projects/${projectId}/routes/${routeId}/primary-model`);
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as {
    data?: { modelId?: string; provider?: string } | null;
  };
  const data = body.data;
  if (!data?.modelId || !data.provider) return null;
  return { modelId: data.modelId, provider: data.provider };
}
