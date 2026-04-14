/**
 * Shared shape for resolve + simulate success payloads (contractVersion, decisionMetadata).
 */
import type { ResolvedRouteResult } from "$lib/server/route-resolver";
import { normalizeProviderToCanonicalApi } from "$lib/server/canonical-provider";

/** Bump when resolve/simulate JSON semantics change (see docs/release-readiness.md). */
export const RESOLVE_SIMULATE_CONTRACT_VERSION = "2026-04-14";

export type RouteMetaBlock = {
  id: string;
  environmentId: string;
  workload: string | null;
  stage: string | null;
  enabled: boolean | null;
  version: number | null;
  publishedVersion: number | null;
};

export function buildRouteMeta(route: ResolvedRouteResult["route"]): RouteMetaBlock {
  return {
    id: route.id,
    environmentId: route.environmentId,
    workload: route.workload ?? null,
    stage: route.stage ?? null,
    enabled: route.enabled ?? null,
    version: route.version ?? null,
    publishedVersion: route.publishedVersion ?? null,
  };
}

/** Success `data` object for POST resolve (and aligned fields for simulate). */
export function buildResolveSuccessData(args: {
  resolved: ResolvedRouteResult;
  traceId: string | null;
  estimatedCostUsd: number | null;
}): Record<string, unknown> {
  const { resolved, traceId, estimatedCostUsd } = args;
  const routeMeta = buildRouteMeta(resolved.route);
  const providerType =
    normalizeProviderToCanonicalApi(resolved.providerType) ?? resolved.providerType ?? null;
  const modelId = resolved.modelId ?? null;

  return {
    contractVersion: RESOLVE_SIMULATE_CONTRACT_VERSION,
    traceId,
    routeId: resolved.route.id,
    routeName: resolved.route.name,
    route: routeMeta,
    providerType,
    modelId,
    explanation: resolved.explanation,
    selectedStepId: resolved.selectedStepId ?? null,
    selectedOrderIndex: resolved.selectedOrderIndex ?? null,
    switchReasonCode: resolved.switchReasonCode ?? null,
    estimatedCostUsd,
    matchedCriteria: resolved.matchedCriteria ?? null,
    fallbackCandidates: resolved.fallbackCandidates ?? [],
    stepChain: resolved.stepChain ?? [],
    decisionMetadata: {
      selectedStepId: resolved.selectedStepId ?? null,
      selectedOrderIndex: resolved.selectedOrderIndex ?? null,
      switchReasonCode: resolved.switchReasonCode ?? null,
      providerType,
      modelId,
      estimatedCostUsd,
      matchedCriteria: resolved.matchedCriteria ?? null,
      fallbackCandidates: resolved.fallbackCandidates ?? [],
      stepChain: resolved.stepChain ?? [],
      route: routeMeta,
    },
  };
}
