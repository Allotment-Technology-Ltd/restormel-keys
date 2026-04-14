import type { PolicyRecord, RouteRecord, RouteStepRecord } from "./neon";
import { isRoutePublished } from "./route-resolver";

/** Aligned with routing contract additive surface; bump when explain payload shape changes. */
export const ROUTING_EXPLAIN_CHAIN_CONTRACT = "2026-04-15" as const;

export type RoutingExplainChainScope = "workspace" | "project" | "environment" | "route";

export type ContextualPolicyRow = {
  scope: RoutingExplainChainScope;
  bindingId: string;
  policyId: string;
  name: string;
  type: string;
  status: string;
  ruleSummary: string;
  ruleDefinition?: Record<string, unknown> | null;
};

/** Aggregated POST /catalog/observations counts for a catalog provider+model pair (read-only hints). */
export type CatalogCrowdHintRow = {
  stepId: string | null;
  catalogProviderId: string;
  providerModelId: string;
  deprecatedReportCount: number;
  retiredReportCount: number;
};

function triggerStrings(obj: Record<string, unknown> | null | undefined, key: string): string[] | undefined {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  const v = obj[key];
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return out.length ? out : undefined;
}

export function summarizePolicyRule(type: string, rule: Record<string, unknown> | null | undefined): string {
  if (!rule) return "no rule payload";
  if (type === "model_allowlist" || type === "model_denylist") {
    const ids = (rule.modelIds as string[]) ?? [];
    return ids.length ? `models: ${ids.slice(0, 12).join(", ")}${ids.length > 12 ? "…" : ""}` : "models: (empty list)";
  }
  if (type === "provider_allowlist" || type === "provider_denylist") {
    const pts = (rule.providerTypes as string[]) ?? [];
    return pts.length
      ? `providers: ${pts.join(", ")}`
      : "providers: (empty list)";
  }
  if (type === "deprecated_model_block") {
    return "blocks deprecated or retired catalog models when lifecycle state applies";
  }
  if (type === "budget_cap" || type === "token_cap") {
    const limit = typeof rule.limit === "number" && rule.limit >= 0 ? rule.limit : null;
    return limit != null ? `${type} limit=${limit}` : `${type} (limit not set)`;
  }
  const keys = Object.keys(rule);
  return keys.length ? `custom rule keys: ${keys.slice(0, 8).join(", ")}` : "empty rule object";
}

function stepRowForExplain(s: RouteStepRecord, route: RouteRecord) {
  const sw = s.switchCriteria as Record<string, unknown> | undefined;
  const rp = s.retryPolicy as Record<string, unknown> | undefined;
  const advanceOn = triggerStrings(sw, "advanceOn");
  const retryOn = triggerStrings(rp, "retryOn");
  return {
    stepId: s.id,
    orderIndex: s.orderIndex,
    providerPreference: s.providerPreference,
    modelId: (s.modelId ?? route.defaultModelId) ?? null,
    enabled: s.enabled !== false,
    label: s.label ?? null,
    hasConditionBlock: s.conditionBlock != null && Object.keys(s.conditionBlock).length > 0,
    ...(advanceOn ? { advanceOn } : {}),
    ...(retryOn ? { retryOn } : {}),
  };
}

/**
 * Agent-oriented summary: route lifecycle, ordered step chain hints, and policies that participate in resolve
 * (workspace → project → environment → route bindings), without calling providers or evaluate.
 */
export function buildRoutingExplainChainData(params: {
  projectId: string;
  route: RouteRecord;
  steps: RouteStepRecord[];
  contextualPolicies: Array<{ scope: RoutingExplainChainScope; bindingId: string; policy: PolicyRecord }>;
  includePolicyRuleJson?: boolean;
  /** When present (typically from `includeCatalogHints` on GET explain-chain), non-empty rows are crowdsignal aggregates only. */
  catalogCrowdHints?: CatalogCrowdHintRow[];
}): {
  contractVersion: typeof ROUTING_EXPLAIN_CHAIN_CONTRACT;
  projectId: string;
  routeId: string;
  environmentId: string;
  route: {
    id: string;
    name: string;
    environmentId: string;
    workload: string | null;
    stage: string | null;
    routeMode: string | null;
    enabled: boolean;
    status: string;
    isPublished: boolean;
    version: number | null;
    publishedVersion: number | null;
    defaultModelId: string | null;
    billingMode: string | null;
  };
  steps: {
    total: number;
    enabledCount: number;
    ordered: ReturnType<typeof stepRowForExplain>[];
  };
  policies: ContextualPolicyRow[];
  /** Present when caller supplied non-empty catalog crowdsignal rows (opt-in). */
  catalogCrowdHints?: CatalogCrowdHintRow[];
  narrative: string[];
} {
  const { route, steps, projectId, contextualPolicies, includePolicyRuleJson, catalogCrowdHints } = params;
  const ordered = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const enabledCount = ordered.filter((s) => s.enabled !== false).length;

  const policyRows: ContextualPolicyRow[] = contextualPolicies.map(({ scope, bindingId, policy }) => {
    const rule = (policy.ruleDefinition as Record<string, unknown> | null) ?? null;
    const row: ContextualPolicyRow = {
      scope,
      bindingId,
      policyId: policy.id,
      name: policy.name,
      type: policy.type,
      status: policy.status ?? "active",
      ruleSummary: summarizePolicyRule(policy.type, rule),
    };
    if (includePolicyRuleJson) row.ruleDefinition = policy.ruleDefinition as Record<string, unknown> | null;
    return row;
  });

  const narrative: string[] = [];
  narrative.push(
    `Route "${route.name}" (${route.id}) in environment ${route.environmentId} for project ${projectId}.`,
  );
  narrative.push(
    route.enabled === false
      ? "Route is disabled; resolve will not select it."
      : route.status !== "active"
        ? `Route status is ${route.status} (not active).`
        : isRoutePublished(route)
          ? "Route has a published version (eligible for discovery when other metadata matches)."
          : "Route is unpublished (draft); explicit resolve by id may return route_unpublished.",
  );
  if (route.workload || route.stage) {
    narrative.push(
      `Ingestion metadata: workload=${route.workload ?? "—"}, stage=${route.stage ?? "—"}.`,
    );
  }
  narrative.push(
    `${ordered.length} step(s), ${enabledCount} enabled; ordered tiers use providerPreference + modelId (or route defaultModelId).`,
  );
  if (policyRows.length === 0) {
    narrative.push("No active policies bound at workspace, project, environment, or route scope for this context.");
  } else {
    narrative.push(
      `${policyRows.length} policy binding(s) may apply at resolve time (see policies[].scope and ruleSummary).`,
    );
  }
  if (catalogCrowdHints !== undefined) {
    if (catalogCrowdHints.length > 0) {
      narrative.push(
        `Catalog crowdsignals (aggregated reports only): ${catalogCrowdHints.length} provider/model pair(s) with non-zero deprecated or retired report counts — see catalogCrowdHints[].`,
      );
    } else {
      narrative.push(
        "Catalog crowdsignal query returned no non-zero deprecated/retired counts for this route's model pairs.",
      );
    }
  }

  return {
    contractVersion: ROUTING_EXPLAIN_CHAIN_CONTRACT,
    projectId,
    routeId: route.id,
    environmentId: route.environmentId,
    route: {
      id: route.id,
      name: route.name,
      environmentId: route.environmentId,
      workload: route.workload ?? null,
      stage: route.stage ?? null,
      routeMode: route.routeMode ?? null,
      enabled: route.enabled !== false,
      status: route.status,
      isPublished: isRoutePublished(route),
      version: route.version ?? null,
      publishedVersion: route.publishedVersion ?? null,
      defaultModelId: route.defaultModelId ?? null,
      billingMode: route.billingMode ?? null,
    },
    steps: {
      total: ordered.length,
      enabledCount,
      ordered: ordered.map((s) => stepRowForExplain(s, route)),
    },
    policies: policyRows,
    ...(catalogCrowdHints !== undefined ? { catalogCrowdHints } : {}),
    narrative,
  };
}
