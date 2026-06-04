/**
 * Route resolution for request execution: project + environment → route → step → provider/model.
 * Used by the execution API after Gateway Key auth. Does not depend on packages/core.
 * Policy enforcement: first enabled step with no policy violations is selected; if all are blocked, returns policyViolations.
 */
import {
  getProject,
  getOrCreateDefaultWorkspace,
  listRoutes,
  getRoute,
  getRouteWithSteps,
  listRouteStepEdges,
  evaluatePolicies,
  getModelsLifecycleByIds,
  type RouteRecord,
  type RouteStepRecord,
  type PolicyViolation,
} from "$lib/server/db";
import { computeEnabledStepOrderForGraph } from "$lib/server/route-order-graph";
import {
  canonicalApiToPolicyProvider,
  normalizeProviderToCanonicalApi,
  isExecutableProviderModelPair,
} from "$lib/server/canonical-provider";
import { expandPoolMembersFromStep, orderPoolCandidates } from "$lib/server/model-pool";
import { resolveModuleFlagsSync } from "$lib/server/module-flags";

/** Rich metadata for one tier in resolve `stepChain` / simulate (contract 2026-04-16+). */
export type ResolveStepChainRow = {
  stepId: string;
  orderIndex: number;
  providerType: string | null;
  modelId: string | null;
  enabled: boolean;
  selected: boolean;
  label?: string | null;
  timeoutMs?: number | null;
  fallbackOn?: string | null;
  switchCriteria?: Record<string, unknown> | null;
  retryPolicy?: Record<string, unknown> | null;
  costPolicy?: Record<string, unknown> | null;
  notes?: string | null;
  /** When `switchCriteria.advanceOn` is a string array, echoed here for hosts (Keys does not evaluate). */
  advanceOn?: string[];
  /** When `retryPolicy.retryOn` is a string array, echoed here for hosts (Keys does not evaluate). */
  retryOn?: string[];
  /** Raw `model_pool` JSON when set. */
  modelPool?: Record<string, unknown> | null;
  /** Selection strategy when `modelPool` is present. */
  poolSelectionStrategy?: string | null;
  /** Index into `poolMembers` for the resolved row (null when no pool). */
  poolMemberIndex?: number | null;
  /** Ordered pool members (canonical provider types) for UI and hosts. */
  poolMembers?: Array<{ providerType: string | null; modelId: string | null }>;
  /** Optional parallel group id (metadata; v1 resolver remains linear). */
  parallelGroupId?: string | null;
  /** Optional role within a parallel group (e.g. fan_out, fan_in). */
  parallelBranchRole?: string | null;
};

/** Steps after the winner; same fields except `selected` (always false if present). */
export type ResolveStepChainFallbackRow = Omit<ResolveStepChainRow, "selected">;

function stringTriggerArray(
  obj: Record<string, unknown> | null | undefined,
  key: string
): string[] | undefined {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  const v = obj[key];
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return out.length ? out : undefined;
}

/** Optional Portkey/LiteLLM-style hints stored in step JSON; Keys returns only — hosts interpret. */
function tierTriggerHintsFromStep(s: RouteStepRecord): Pick<ResolveStepChainRow, "advanceOn" | "retryOn"> {
  const sw = s.switchCriteria as Record<string, unknown> | undefined;
  const rp = s.retryPolicy as Record<string, unknown> | undefined;
  const advanceOn = stringTriggerArray(sw, "advanceOn");
  const retryOn = stringTriggerArray(rp, "retryOn");
  return {
    ...(advanceOn ? { advanceOn } : {}),
    ...(retryOn ? { retryOn } : {}),
  };
}

type ChainRowContext = {
  seed: string;
  attemptNumber: number;
  winnerStepId: string | null;
  winner?: { memberIndex: number | null; providerType: string | null; modelId: string | null } | null;
};

function buildResolveStepChainRow(
  s: RouteStepRecord,
  routeRecord: RouteRecord,
  selected: boolean,
  ctx: ChainRowContext
): ResolveStepChainRow {
  const { pool, candidates } = expandPoolMembersFromStep(s, routeRecord.defaultModelId ?? null);
  const strategy = pool?.selectionStrategy ?? "first_eligible";
  const ordered = orderPoolCandidates(strategy, candidates, ctx.seed, ctx.attemptNumber, s.orderIndex, pool);
  const poolMembers = ordered.map((c) => ({
    providerType: normalizeProviderToCanonicalApi(c.providerPreference),
    modelId: c.modelId ?? null,
  }));
  const winner = ctx.winner;
  const isWinner = ctx.winnerStepId === s.id && winner != null;
  const preview = ordered[0];
  const effectiveProvider = isWinner
    ? winner.providerType
    : normalizeProviderToCanonicalApi(preview?.providerPreference ?? null);
  const effectiveModel = isWinner
    ? winner.modelId
    : (preview?.modelId ?? routeRecord.defaultModelId) ?? null;
  const poolMemberIndex =
    isWinner && winner.memberIndex != null
      ? winner.memberIndex
      : pool
        ? ordered[0]?.memberIndex ?? 0
        : null;

  return {
    stepId: s.id,
    orderIndex: s.orderIndex,
    providerType: effectiveProvider,
    modelId: effectiveModel,
    enabled: s.enabled,
    selected,
    label: s.label ?? null,
    timeoutMs: s.timeoutMs,
    fallbackOn: s.fallbackOn ?? null,
    switchCriteria: s.switchCriteria ?? null,
    retryPolicy: s.retryPolicy ?? null,
    costPolicy: s.costPolicy ?? null,
    notes: s.notes ?? null,
    ...(pool ? { modelPool: s.modelPool ?? null, poolSelectionStrategy: strategy, poolMemberIndex, poolMembers } : {}),
    parallelGroupId: s.parallelGroupId ?? null,
    parallelBranchRole: s.parallelBranchRole ?? null,
    ...tierTriggerHintsFromStep(s),
  };
}

function violationKey(v: PolicyViolation): string {
  return `${v.policyId}:${v.type}:${v.message}`;
}

function dedupeViolations(violations: PolicyViolation[]): PolicyViolation[] {
  const seen = new Set<string>();
  const out: PolicyViolation[] = [];
  for (const v of violations) {
    const k = violationKey(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/**
 * Same pool walk as resolve: first eligible member after ordering. Used by simulate diagnostics.
 */
export async function selectExecutableMemberForStep(
  step: RouteStepRecord,
  routeRecord: RouteRecord,
  workspaceId: string,
  environmentId: string,
  routeId: string,
  lifecycleByModel: Map<string, string | undefined>,
  seed: string,
  attemptNumber: number
): Promise<
  | {
      ok: true;
      canonicalProvider: string;
      modelId: string;
      memberIndex: number | null;
    }
  | { ok: false; policyViolations: PolicyViolation[]; sawNotExecutable: boolean }
> {
  const { pool, candidates } = expandPoolMembersFromStep(step, routeRecord.defaultModelId ?? null);
  const strategy = pool?.selectionStrategy ?? "first_eligible";
  const ordered = orderPoolCandidates(strategy, candidates, seed, attemptNumber, step.orderIndex, pool);
  const merged: PolicyViolation[] = [];
  let sawNotExecutable = false;
  for (const cand of ordered) {
    const modelId = cand.modelId ?? undefined;
    const policyProvider =
      canonicalApiToPolicyProvider(normalizeProviderToCanonicalApi(cand.providerPreference)) ??
      (cand.providerPreference?.trim() ? cand.providerPreference.trim() : undefined);
    const lifecycleState = modelId ? lifecycleByModel.get(modelId) : undefined;
    const violations = resolveModuleFlagsSync().guardrails
      ? await evaluatePolicies({
          workspaceId,
          projectId: routeRecord.projectId,
          environmentId,
          routeId,
          routeStepId: step.id,
          modelId,
          providerType: policyProvider,
          modelLifecycleState: lifecycleState,
        })
      : [];
    if (violations.length > 0) {
      merged.push(...violations);
      continue;
    }
    const exec = isExecutableProviderModelPair(cand.providerPreference, cand.modelId);
    if (!exec.ok) {
      sawNotExecutable = true;
      continue;
    }
    return {
      ok: true,
      canonicalProvider: exec.canonicalProvider,
      modelId: exec.modelId,
      memberIndex: pool ? cand.memberIndex : null,
    };
  }
  return { ok: false, policyViolations: dedupeViolations(merged), sawNotExecutable };
}

function toFallbackRow(row: ResolveStepChainRow): ResolveStepChainFallbackRow {
  const { selected: _selected, ...rest } = row;
  return rest;
}

export type ResolvedRouteResult = {
  workspaceId: string;
  projectId: string;
  environmentId: string;
  route: RouteRecord;
  steps: RouteStepRecord[];
  /** First enabled step that passes policy, or null if none or all blocked. */
  selectedStep: RouteStepRecord | null;
  /** Machine-readable selected step details for stage-aware switch UIs. */
  selectedStepId?: string | null;
  selectedOrderIndex?: number | null;
  switchReasonCode?: string | null;
  /** Provider type from selected step (provider_preference) or null. */
  providerType: string | null;
  /** Model id from selected step or route default. */
  modelId: string | null;
  /** When the winning step used a pool, index of the selected member (otherwise null). */
  selectedPoolMemberIndex?: number | null;
  /** Explanation for logging/audit. */
  explanation: string;
  /** Criteria that matched on selected step (switchCriteria snapshot). */
  matchedCriteria?: Record<string, unknown> | null;
  /** Ordered candidates considered after selected step. */
  fallbackCandidates?: ResolveStepChainFallbackRow[];
  /** All enabled steps in route order with canonical providerType/modelId (support, billing, forensics). */
  stepChain?: ResolveStepChainRow[];
  /** Set when there were enabled steps but all were blocked by policy (selectedStep is null). */
  policyViolations?: PolicyViolation[];
};

export type ResolveRouteFailureCode =
  | "no_route"
  | "route_unpublished"
  | "route_disabled"
  | "no_key_available"
  | "resolve_incomplete";

export type ResolveRouteFailure = {
  code: ResolveRouteFailureCode;
  routeId?: string;
  message?: string;
};

export type ResolveRouteOutcome =
  | { ok: true; result: ResolvedRouteResult }
  | { ok: false; failure: ResolveRouteFailure };

export function isRoutePublished(route: RouteRecord): boolean {
  const v = route.version ?? 1;
  const p = route.publishedVersion ?? 1;
  return v === p;
}

function isNullStage(stage: string | null | undefined): boolean {
  return stage == null || String(stage).trim() === "";
}

async function findRouteByIdOrName(
  projectId: string,
  userId: string,
  routeIdOrName: string
): Promise<RouteRecord | null> {
  const trimmed = routeIdOrName.trim();
  if (!trimmed) return null;
  const byId = await getRoute(trimmed, projectId, userId);
  if (byId) return byId;
  const inProject = await listRoutes(projectId, userId);
  return inProject.find((r) => r.name === trimmed) ?? null;
}

/** Route + ordered enabled steps + model lifecycle map (shared by resolve and hosted runtime pipeline). */
export type RouteExecutionContext = {
  workspaceId: string;
  projectId: string;
  environmentId: string;
  route: RouteRecord;
  allSteps: RouteStepRecord[];
  orderedEnabledSteps: RouteStepRecord[];
  lifecycleByModel: Map<string, string | undefined>;
};

/**
 * Load a published route by id/name and compute graph-linear step order (same as resolve).
 * Used by hosted runtime Phase 2 multi-step pipeline.
 */
export async function loadRouteExecutionContext(
  projectId: string,
  environmentId: string,
  userId: string,
  routeIdOrName: string
): Promise<{ ok: true; ctx: RouteExecutionContext } | { ok: false; failure: ResolveRouteFailure }> {
  const project = await getProject(projectId, userId);
  if (!project) {
    return { ok: false, failure: { code: "no_route", message: "Project not found" } };
  }

  const workspaceId =
    project.workspaceId ?? (await getOrCreateDefaultWorkspace(project.userId)).id;

  const route = await findRouteByIdOrName(projectId, userId, routeIdOrName.trim());
  if (!route) {
    return { ok: false, failure: { code: "no_route", message: "No route matched routeId" } };
  }
  const life = classifyRouteForExplicitId(route, environmentId);
  if (life) {
    return { ok: false, failure: life };
  }

  const withSteps = await getRouteWithSteps(route.id, projectId, userId);
  if (!withSteps) {
    return { ok: false, failure: { code: "no_route", routeId: route.id, message: "Route not found" } };
  }

  const { route: routeRecord, steps } = withSteps;
  const graphEdges = await listRouteStepEdges(routeRecord.id, projectId, userId);
  const edgeInputs = graphEdges.map((e) => ({
    fromStepId: e.fromStepId,
    toStepId: e.toStepId,
    priority: e.priority,
  }));
  const orderedEnabledSteps =
    edgeInputs.length > 0
      ? computeEnabledStepOrderForGraph(steps, edgeInputs, routeRecord.entryStepId ?? null)
      : steps
          .filter((s) => s.enabled)
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex);

  const modelIdSet = new Set<string>();
  if (routeRecord.defaultModelId) modelIdSet.add(routeRecord.defaultModelId);
  for (const s of orderedEnabledSteps) {
    const { candidates } = expandPoolMembersFromStep(s, routeRecord.defaultModelId ?? null);
    for (const c of candidates) {
      if (c.modelId) modelIdSet.add(c.modelId);
    }
  }
  const modelIds = [...modelIdSet];
  const lifecycleByModel = new Map(
    (await getModelsLifecycleByIds(modelIds)).map((m) => [m.id, m.lifecycleState ?? undefined])
  );

  return {
    ok: true,
    ctx: {
      workspaceId,
      projectId,
      environmentId,
      route: routeRecord,
      allSteps: steps,
      orderedEnabledSteps,
      lifecycleByModel,
    },
  };
}

/** Failure ordering when routeId is explicit: wrong env / missing → no_route before lifecycle checks. */
function classifyRouteForExplicitId(route: RouteRecord, environmentId: string): ResolveRouteFailure | null {
  if (route.environmentId !== environmentId) {
    return { code: "no_route", message: "Route is not bound to this environment" };
  }
  if (route.status !== "active") {
    return { code: "route_disabled", routeId: route.id, message: "Route is not active" };
  }
  if (route.enabled === false) {
    return { code: "route_disabled", routeId: route.id, message: "Route is disabled" };
  }
  if (!isRoutePublished(route)) {
    return { code: "route_unpublished", routeId: route.id, message: "Route has no published version" };
  }
  return null;
}

/**
 * Pick a published, active, enabled route for metadata-based discovery (no routeId).
 * SOPHIA ingestion: dedicated `workload=ingestion` + `stage=ingestion_<sub>` then shared `workload=ingestion` + null stage.
 */
async function selectRouteForDiscovery(
  projectId: string,
  userId: string,
  environmentId: string,
  workload?: string | null,
  stage?: string | null
): Promise<RouteRecord | null> {
  const wl = workload?.trim() || undefined;
  const st = stage?.trim() || undefined;

  const isSelectable = (r: RouteRecord) =>
    r.status === "active" &&
    (r.enabled ?? true) &&
    isRoutePublished(r) &&
    r.environmentId === environmentId;

  if (wl && st) {
    const dedicated = await listRoutes(projectId, userId, {
      environmentId,
      workload: wl,
      stage: st,
    });
    const d = dedicated.find(isSelectable);
    if (d) return d;
    const forWorkload = await listRoutes(projectId, userId, { environmentId, workload: wl });
    const shared = forWorkload.find((r) => isSelectable(r) && isNullStage(r.stage));
    return shared ?? null;
  }

  if (wl && !st) {
    const forWorkload = await listRoutes(projectId, userId, { environmentId, workload: wl });
    return forWorkload.find((r) => isSelectable(r) && isNullStage(r.stage)) ?? null;
  }

  if (!wl && st) {
    const forStage = await listRoutes(projectId, userId, { environmentId, stage: st });
    return forStage.find(isSelectable) ?? null;
  }

  const allInEnv = await listRoutes(projectId, userId, { environmentId });
  return allInEnv.find(isSelectable) ?? null;
}

/**
 * Resolve route and provider/model for a request. Uses first matching published route for the environment,
 * then first enabled step. Provider = step.providerPreference, model = step.modelId ?? route.defaultModelId.
 * Caller must have already verified project access (e.g. gateway key or session).
 */
export async function resolveRouteForExecution(
  projectId: string,
  environmentId: string,
  userId: string,
  options?: {
    routeId?: string;
    stage?: string | null;
    workload?: string | null;
    task?: string | null;
    attemptNumber?: number;
    previousFailure?: { selectedOrderIndex?: number | null; selectedStepId?: string | null };
    failureKind?: string | null;
  }
): Promise<ResolveRouteOutcome> {
  const project = await getProject(projectId, userId);
  if (!project) {
    return { ok: false, failure: { code: "no_route", message: "Project not found" } };
  }

  const workspaceId =
    project.workspaceId ?? (await getOrCreateDefaultWorkspace(project.userId)).id;

  const routeIdOpt = options?.routeId?.trim();

  let route: RouteRecord | null = null;

  if (routeIdOpt) {
    route = await findRouteByIdOrName(projectId, userId, routeIdOpt);
    if (!route) {
      return { ok: false, failure: { code: "no_route", message: "No route matched routeId" } };
    }
    const life = classifyRouteForExplicitId(route, environmentId);
    if (life) {
      return { ok: false, failure: life };
    }
  } else {
    route = await selectRouteForDiscovery(
      projectId,
      userId,
      environmentId,
      options?.workload ?? undefined,
      options?.stage ?? undefined
    );
    if (!route) {
      return { ok: false, failure: { code: "no_route", message: "No published route matched constraints" } };
    }
  }

  const withSteps = await getRouteWithSteps(route.id, projectId, userId);
  if (!withSteps) {
    return { ok: false, failure: { code: "no_route", routeId: route.id, message: "Route not found" } };
  }

  const { route: routeRecord, steps } = withSteps;
  const graphEdges = await listRouteStepEdges(routeRecord.id, projectId, userId);
  const edgeInputs = graphEdges.map((e) => ({
    fromStepId: e.fromStepId,
    toStepId: e.toStepId,
    priority: e.priority,
  }));
  const orderedEnabledSteps =
    edgeInputs.length > 0
      ? computeEnabledStepOrderForGraph(steps, edgeInputs, routeRecord.entryStepId ?? null)
      : steps
          .filter((s) => s.enabled)
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex);

  const graphIndexById = new Map(orderedEnabledSteps.map((s, i) => [s.id, i]));

  const attemptNumber = options?.attemptNumber ?? 0;
  const prev = options?.previousFailure;
  let skipThroughGraphIndex = -1;
  if (attemptNumber > 0 && prev) {
    if (prev.selectedStepId && graphIndexById.has(prev.selectedStepId)) {
      skipThroughGraphIndex = graphIndexById.get(prev.selectedStepId)!;
    } else if (prev.selectedOrderIndex != null && Number.isFinite(prev.selectedOrderIndex)) {
      const match = orderedEnabledSteps.find((s) => s.orderIndex === prev.selectedOrderIndex);
      if (match) skipThroughGraphIndex = graphIndexById.get(match.id) ?? -1;
    }
  }

  const modelIdSet = new Set<string>();
  if (routeRecord.defaultModelId) modelIdSet.add(routeRecord.defaultModelId);
  for (const s of orderedEnabledSteps) {
    const { candidates } = expandPoolMembersFromStep(s, routeRecord.defaultModelId ?? null);
    for (const c of candidates) {
      if (c.modelId) modelIdSet.add(c.modelId);
    }
  }
  const modelIds = [...modelIdSet];
  const lifecycleByModel = new Map(
    (await getModelsLifecycleByIds(modelIds)).map((m) => [m.id, m.lifecycleState ?? undefined])
  );

  const allViolations: PolicyViolation[] = [];
  let sawPolicyPassIncomplete = false;

  const seed = `${projectId}:${routeRecord.id}:${environmentId}:${attemptNumber}`;

  const stepChainNoWinner = orderedEnabledSteps.map((s) =>
    buildResolveStepChainRow(s, routeRecord, false, {
      seed,
      attemptNumber,
      winnerStepId: null,
      winner: null,
    })
  );

  for (const step of orderedEnabledSteps) {
    const gi = graphIndexById.get(step.id) ?? 0;
    if (attemptNumber > 0 && gi <= skipThroughGraphIndex) continue;

    const picked = await selectExecutableMemberForStep(
      step,
      routeRecord,
      workspaceId,
      environmentId,
      routeRecord.id,
      lifecycleByModel,
      seed,
      attemptNumber
    );
    if (!picked.ok) {
      allViolations.push(...picked.policyViolations);
      if (picked.sawNotExecutable) sawPolicyPassIncomplete = true;
      continue;
    }

    const canonicalProvider = picked.canonicalProvider;
    const resolvedModelId = picked.modelId;
    const memberIndex = picked.memberIndex;
    const explanation =
      memberIndex != null
        ? `route=${routeRecord.id} step=${step.orderIndex} poolMember=${memberIndex} provider=${canonicalProvider} model=${resolvedModelId}`
        : `route=${routeRecord.id} step=${step.orderIndex} provider=${canonicalProvider} model=${resolvedModelId}`;

    const chainCtx: ChainRowContext = {
      seed,
      attemptNumber,
      winnerStepId: step.id,
      winner: {
        memberIndex,
        providerType: canonicalProvider,
        modelId: resolvedModelId,
      },
    };
    const stepChain = orderedEnabledSteps.map((s) =>
      buildResolveStepChainRow(s, routeRecord, s.id === step.id, chainCtx)
    );
    const winnerGi = graphIndexById.get(step.id) ?? 0;
    return {
      ok: true,
      result: {
        workspaceId,
        projectId,
        environmentId,
        route: routeRecord,
        steps,
        selectedStep: step,
        selectedStepId: step.id,
        selectedOrderIndex: step.orderIndex,
        switchReasonCode:
          attemptNumber > 0
            ? options?.failureKind ?? "switched_after_previous_failure"
            : "initial_selection",
        providerType: canonicalProvider,
        modelId: resolvedModelId,
        selectedPoolMemberIndex: memberIndex,
        explanation,
        matchedCriteria: step.switchCriteria ?? null,
        stepChain,
        fallbackCandidates: orderedEnabledSteps
          .filter((_, i) => i > winnerGi)
          .map((s) => toFallbackRow(buildResolveStepChainRow(s, routeRecord, false, chainCtx))),
      },
    };
  }

  if (orderedEnabledSteps.length > 0 && sawPolicyPassIncomplete) {
    return {
      ok: false,
      failure: {
        code: "resolve_incomplete",
        routeId: routeRecord.id,
        message:
          "A route step passed policy but has no executable providerType and modelId. Configure provider and model on the step or route default model.",
      },
    };
  }

  const allSkippedByAttempt =
    orderedEnabledSteps.length > 0 &&
    attemptNumber > 0 &&
    orderedEnabledSteps.every((_s, i) => i <= skipThroughGraphIndex);
  if (allSkippedByAttempt) {
    return {
      ok: false,
      failure: {
        code: "no_key_available",
        routeId: routeRecord.id,
        message: "No further steps to try after previous failure context",
      },
    };
  }

  const selectedStep = null;
  const providerType = null;
  const modelId = null;
  const switchReasonCode =
    attemptNumber > 0 && options?.failureKind ? options.failureKind : null;
  const explanation = orderedEnabledSteps.length > 0
    ? `route=${routeRecord.id} all_steps_blocked_by_policy`
    : `route=${routeRecord.id} no_enabled_step default_model=${routeRecord.defaultModelId ?? "—"}`;

  if (orderedEnabledSteps.length > 0) {
    return {
      ok: true,
      result: {
        workspaceId,
        projectId,
        environmentId,
        route: routeRecord,
        steps,
        selectedStep,
        selectedStepId: null,
        selectedOrderIndex: null,
        switchReasonCode,
        providerType,
        modelId,
        explanation,
        matchedCriteria: null,
        fallbackCandidates: [],
        stepChain: stepChainNoWinner,
        policyViolations: dedupeViolations(allViolations),
      },
    };
  }

  return {
    ok: false,
    failure: {
      code: "no_key_available",
      routeId: routeRecord.id,
      message: "No enabled route step available to resolve provider/model",
    },
  };
}

export type ValidateBindingInput = {
  environmentId: string;
  workload?: string | null;
  stage?: string | null;
  task?: string | null;
};

/**
 * Preflight: same eligibility as resolve (env, published, enabled, metadata match when provided).
 * Does not run policy evaluation on steps.
 */
export async function validateRouteBinding(
  projectId: string,
  userId: string,
  routeId: string,
  input: ValidateBindingInput
): Promise<{ ok: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const route = await findRouteByIdOrName(projectId, userId, routeId);
  if (!route) {
    return { ok: false, reasons: ["route_not_found"] };
  }
  if (route.environmentId !== input.environmentId.trim()) {
    reasons.push("environment_mismatch");
  }
  if (route.status !== "active") {
    reasons.push("route_inactive");
  }
  if (route.enabled === false) {
    reasons.push("route_disabled");
  }
  if (!isRoutePublished(route)) {
    reasons.push("route_unpublished");
  }

  const wl = input.workload?.trim();
  const st = input.stage?.trim();
  if (wl || st) {
    if (wl && route.workload !== wl) {
      reasons.push("workload_mismatch");
    }
    if (wl && st) {
      const dedicatedMatch = route.workload === wl && route.stage === st;
      const sharedFallbackMatch = route.workload === wl && isNullStage(route.stage);
      if (!dedicatedMatch && !sharedFallbackMatch) {
        reasons.push("ingestion_metadata_mismatch");
      }
    } else if (wl && !st) {
      if (route.workload !== wl || !isNullStage(route.stage)) {
        reasons.push("expected_shared_route_null_stage");
      }
    } else if (!wl && st) {
      if (route.stage !== st) {
        reasons.push("stage_mismatch");
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}
