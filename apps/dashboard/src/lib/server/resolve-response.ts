/**
 * Shared shape for resolve + simulate success payloads (contractVersion, decisionMetadata).
 */
import type { ResolvedRouteResult } from "$lib/server/route-resolver";
import { normalizeProviderToCanonicalApi } from "$lib/server/canonical-provider";
import { RUNTIME_SWITCH_EVAL_VERSION } from "$lib/server/runtime-switch-eval";

/** Bump when resolve/simulate JSON semantics change (see docs/governance/release-readiness.md). */
export const RESOLVE_SIMULATE_CONTRACT_VERSION = "2026-04-16";

/** Hosted POST …/runtime/invoke success payload (Phase 2 pipeline; Phase 3 switch-eval on upstream failure). */
export const RUNTIME_INVOKE_CONTRACT_VERSION = "2026-06-01";

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
    contract_version: RESOLVE_SIMULATE_CONTRACT_VERSION,
    traceId,
    routeId: resolved.route.id,
    routeName: resolved.route.name,
    route: routeMeta,
    providerType,
    modelId,
    selectedPoolMemberIndex: resolved.selectedPoolMemberIndex ?? null,
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
      selectedPoolMemberIndex: resolved.selectedPoolMemberIndex ?? null,
      estimatedCostUsd,
      matchedCriteria: resolved.matchedCriteria ?? null,
      fallbackCandidates: resolved.fallbackCandidates ?? [],
      stepChain: resolved.stepChain ?? [],
      route: routeMeta,
    },
  };
}

/** Per-step row for hosted runtime (no secrets). */
export type RuntimeInvokeStepRow = {
  routeStepId: string;
  orderIndex: number;
  providerType: string | null;
  modelId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  skipped?: boolean;
  skipReason?: string;
};

/** Success `data` for POST …/routes/{routeId}/runtime/invoke (extends resolve fields). */
export function buildRuntimeInvokeSuccessData(args: {
  resolved: ResolvedRouteResult;
  traceId: string | null;
  estimatedCostUsd: number | null;
  content: string;
  usage: {
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
  };
  /** Phase 2: pipeline steps executed or skipped (message chaining: each step after the first sees prior output as a user message). */
  runtimeSteps?: RuntimeInvokeStepRow[];
}): Record<string, unknown> {
  const resolveBlock = buildResolveSuccessData({
    resolved: args.resolved,
    traceId: args.traceId,
    estimatedCostUsd: args.estimatedCostUsd,
  });
  return {
    runtimeContractVersion: RUNTIME_INVOKE_CONTRACT_VERSION,
    runtimeSwitchEvalVersion: RUNTIME_SWITCH_EVAL_VERSION,
    content: args.content,
    usage: {
      promptTokens: args.usage.promptTokens ?? null,
      completionTokens: args.usage.completionTokens ?? null,
      totalTokens: args.usage.totalTokens ?? null,
    },
    ...(args.runtimeSteps && args.runtimeSteps.length > 0 ? { runtimeSteps: args.runtimeSteps } : {}),
    ...resolveBlock,
  };
}
