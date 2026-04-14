import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getProject,
  getProjectInWorkspace,
  getRouteWithSteps,
  listPolicyBindingsByTarget,
  listCatalogModelObservationsForPairs,
  type PolicyRecord,
} from "$lib/server/db";
import { normalizeProviderToCanonicalApi } from "$lib/server/canonical-provider";
import {
  buildRoutingExplainChainData,
  type CatalogCrowdHintRow,
  type RoutingExplainChainScope,
} from "$lib/server/route-explain-chain";

async function projectScope(
  locals: App.Locals,
  projectId: string,
): Promise<{ projectId: string; userId: string; workspaceId: string } | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key") {
    if (locals.user.projectIdForKey !== projectId) return null;
    const project = await getProject(projectId, locals.user.uid);
    if (!project?.workspaceId) return null;
    return { projectId, userId: locals.user.uid, workspaceId: project.workspaceId };
  }
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    const project = await getProjectInWorkspace(projectId, locals.user.workspaceId);
    if (!project?.workspaceId) return null;
    return { projectId, userId: project.userId, workspaceId: project.workspaceId };
  }
  const project = await getProject(projectId, locals.user.uid);
  if (!project?.workspaceId) return null;
  return { projectId, userId: locals.user.uid, workspaceId: project.workspaceId };
}

/** GET agent-oriented route + step chain + policy binding summary (read-only; no provider calls). */
export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectScope(locals, params.id);
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    const includePolicyRuleJson = url.searchParams.get("includePolicyRuleJson") === "true";
    const includeCatalogHints = url.searchParams.get("includeCatalogHints") === "true";

    const withSteps = await getRouteWithSteps(params.routeId, scope.projectId, scope.userId);
    if (!withSteps) return json({ error: "Not found" }, { status: 404 });

    const { route, steps } = withSteps;
    const envId = route.environmentId;
    const wsId = scope.workspaceId;

    const [wsBindings, projectBindings, envBindings, routeBindings] = await Promise.all([
      listPolicyBindingsByTarget("workspace", wsId, wsId),
      listPolicyBindingsByTarget("project", scope.projectId, wsId),
      listPolicyBindingsByTarget("environment", envId, wsId),
      listPolicyBindingsByTarget("route", route.id, wsId),
    ]);

    const contextualPolicies: Array<{
      scope: RoutingExplainChainScope;
      bindingId: string;
      policy: PolicyRecord;
    }> = [];

    for (const b of wsBindings) {
      if (b.policy) contextualPolicies.push({ scope: "workspace", bindingId: b.id, policy: b.policy });
    }
    for (const b of projectBindings) {
      if (b.policy) contextualPolicies.push({ scope: "project", bindingId: b.id, policy: b.policy });
    }
    for (const b of envBindings) {
      if (b.policy) contextualPolicies.push({ scope: "environment", bindingId: b.id, policy: b.policy });
    }
    for (const b of routeBindings) {
      if (b.policy) contextualPolicies.push({ scope: "route", bindingId: b.id, policy: b.policy });
    }

    let catalogCrowdHints: CatalogCrowdHintRow[] | undefined;
    if (includeCatalogHints) {
      const ordered = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
      const pairs: { catalogProviderId: string; providerModelId: string }[] = [];
      const stepIdByKey = new Map<string, string | null>();

      const addPair = (providerRaw: string | null | undefined, modelId: string | null | undefined, stepId: string | null) => {
        const mid = typeof modelId === "string" ? modelId.trim() : "";
        if (!mid) return;
        const canon = normalizeProviderToCanonicalApi(providerRaw ?? null);
        if (!canon) return;
        const key = `${canon}\t${mid}`;
        if (stepIdByKey.has(key)) return;
        pairs.push({ catalogProviderId: canon, providerModelId: mid });
        stepIdByKey.set(key, stepId);
      };

      for (const s of ordered) {
        if (s.modelId) addPair(s.providerPreference, s.modelId, s.id);
      }
      if (route.defaultModelId?.trim()) {
        const fallbackProvider =
          ordered.find((s) => s.modelId)?.providerPreference ?? ordered[0]?.providerPreference ?? "openai";
        addPair(fallbackProvider, route.defaultModelId, null);
      }

      const obsMap = pairs.length ? await listCatalogModelObservationsForPairs(pairs) : new Map();
      catalogCrowdHints = pairs
        .map((pair) => {
          const key = `${pair.catalogProviderId}\t${pair.providerModelId}`;
          const obs = obsMap.get(key);
          const row: CatalogCrowdHintRow = {
            stepId: stepIdByKey.get(key) ?? null,
            catalogProviderId: pair.catalogProviderId,
            providerModelId: pair.providerModelId,
            deprecatedReportCount: obs?.deprecatedReportCount ?? 0,
            retiredReportCount: obs?.retiredReportCount ?? 0,
          };
          return row;
        })
        .filter((h) => h.deprecatedReportCount > 0 || h.retiredReportCount > 0);
    }

    const data = buildRoutingExplainChainData({
      projectId: scope.projectId,
      route,
      steps,
      contextualPolicies,
      includePolicyRuleJson,
      catalogCrowdHints,
    });

    return json({ data });
  } catch (e) {
    console.error("[route.explain-chain.get] internal error:", e);
    return json({ error: "internal_error", detail: "route_explain_chain_failed" }, { status: 500 });
  }
};
