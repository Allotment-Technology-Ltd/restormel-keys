/**
 * W3.2 — Request tester state machine + explain-chain mapping.
 *
 * Pure module: no Svelte, no fetch. All types + transformation logic live here
 * so they can be unit-tested without mounting a component.
 */

// ────────────────────────────────────────────────────────────────────────────
// State machine
// ────────────────────────────────────────────────────────────────────────────

export type TesterPhase = "idle" | "running" | "result" | "error";

export interface TesterState {
  phase: TesterPhase;
  /** Populated when phase === "result" */
  result: TesterResult | null;
  /** Populated when phase === "error" */
  errorMessage: string | null;
}

export const TESTER_IDLE: TesterState = { phase: "idle", result: null, errorMessage: null };

export function testerRunning(): TesterState {
  return { phase: "running", result: null, errorMessage: null };
}

export function testerResult(result: TesterResult): TesterState {
  return { phase: "result", result, errorMessage: null };
}

export function testerError(errorMessage: string): TesterState {
  return { phase: "error", result: null, errorMessage };
}

// ────────────────────────────────────────────────────────────────────────────
// Result types
// ────────────────────────────────────────────────────────────────────────────

export interface RoutingAttemptRow {
  stepId: string;
  orderIndex: number;
  providerType: string | null;
  modelId: string | null;
  /** dry-run outcome for this step */
  hypotheticalOutcome: "selected" | "blocked_by_policy" | "not_executable" | "not_selected";
  parallelGroupId?: string | null;
  parallelBranchRole?: string | null;
}

export interface StepDiagRow {
  stepId: string;
  orderIndex: number;
  providerType: string | null;
  modelId: string | null;
  policyViolations: Array<{ policyId: string; policyName: string; type: string; message: string }>;
  executable: boolean;
}

export interface ExplainChainSummary {
  /** Route name from explain-chain */
  routeName: string;
  /** Publish state */
  isPublished: boolean;
  /** Number of enabled steps */
  enabledStepCount: number;
  /** Names/IDs of policies attached at any scope */
  policyNames: string[];
  /** Ordered step summaries */
  steps: Array<{
    stepId: string;
    orderIndex: number;
    providerPreference: string | null;
    modelId: string | null;
    enabled: boolean;
    label: string | null;
  }>;
  /** Raw contract version echoed */
  contractVersion: string | null;
}

/** Result from the "Explain" (simulate + explain-chain) flow — no provider calls. */
export interface ExplainResult {
  kind: "explain";
  routeId: string;
  environmentId: string;
  /** Matched step */
  selectedStepId: string | null;
  /** Provider that would be called */
  providerType: string | null;
  /** Model that would be used */
  modelId: string | null;
  /** Routing decision explanation from resolve engine */
  explanation: string | null;
  /** Per-step dry-run outcomes */
  routingAttempts: RoutingAttemptRow[];
  /** Per-step diagnostics (policy + executable) */
  stepDiagnostics: StepDiagRow[];
  /** Explain-chain summary (route, policies, steps) */
  explainChain: ExplainChainSummary | null;
  /** Policy violations that blocked all steps (if any) */
  policyViolations: Array<{ policyId: string; policyName: string; type: string; message: string }>;
  /** Whether this route would have executed */
  wouldRun: boolean;
  /** Per-step cost estimates */
  perStepEstimates: Array<{
    stepId: string;
    modelId: string | null;
    providerType: string | null;
    estimatedCostUsd: number | null;
    wouldRun: boolean;
  }>;
  /** Contract version from simulate payload */
  contractVersion: string | null;
}

/** Result from "Send real request" — spends user credentials. */
export interface InvokeResult {
  kind: "invoke";
  routeId: string;
  environmentId: string;
  /** Content returned by the model */
  content: string;
  /** Provider used */
  providerType: string | null;
  /** Model used */
  modelId: string | null;
  /** Latency in ms (client-measured) */
  latencyMs: number;
  /** Token usage */
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };
  /** Estimated cost */
  estimatedCostUsd: number | null;
  /** Pipeline steps (Phase 2 multi-step) */
  runtimeSteps: Array<{
    routeStepId: string;
    orderIndex: number;
    providerType: string | null;
    modelId: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    skipped?: boolean;
    skipReason?: string;
  }>;
  /** Request log row link (navigate to /logs filtered) */
  requestLogHref: string | null;
  /** Contract version from invoke payload */
  runtimeContractVersion: string | null;
}

export type TesterResult = ExplainResult | InvokeResult;

// ────────────────────────────────────────────────────────────────────────────
// Explain-chain response mapping
// ────────────────────────────────────────────────────────────────────────────

/**
 * Raw explain-chain response shape from GET /explain-chain.
 * Mirrors the return value of `buildRoutingExplainChainData` in
 * src/lib/server/route-explain-chain.ts:
 *   { contractVersion, projectId, routeId, environmentId,
 *     route: { id, name, isPublished, … },
 *     steps: { total, enabledCount, ordered: [ { stepId, orderIndex, … } ] },
 *     policies: [ { policyId, name, … } ],
 *     narrative }
 */
interface RawExplainChain {
  data?: {
    contractVersion?: string | null;
    projectId?: string;
    routeId?: string;
    environmentId?: string;
    route?: {
      id?: string;
      name?: string | null;
      isPublished?: boolean;
      enabled?: boolean;
      status?: string;
      workload?: string | null;
      stage?: string | null;
      routeMode?: string | null;
      version?: number | null;
      publishedVersion?: number | null;
      defaultModelId?: string | null;
      billingMode?: string | null;
    };
    steps?: {
      total?: number;
      enabledCount?: number;
      ordered?: Array<{
        stepId?: string;
        orderIndex?: number;
        providerPreference?: string | null;
        modelId?: string | null;
        enabled?: boolean;
        label?: string | null;
      }>;
    };
    policies?: Array<{
      policyId?: string;
      name?: string | null;
      scope?: string;
      bindingId?: string;
      type?: string;
      status?: string;
      ruleSummary?: string;
    }>;
    narrative?: string[];
  };
}

/** Map a raw explain-chain API response to our summary type. */
export function mapExplainChain(raw: RawExplainChain): ExplainChainSummary | null {
  const d = raw?.data;
  if (!d) return null;

  const routeObj = d.route;
  const stepsObj = d.steps;

  const steps = Array.isArray(stepsObj?.ordered)
    ? stepsObj.ordered.map((s) => ({
        stepId: typeof s.stepId === "string" ? s.stepId : "",
        orderIndex: typeof s.orderIndex === "number" ? s.orderIndex : 0,
        providerPreference: typeof s.providerPreference === "string" ? s.providerPreference : null,
        modelId: typeof s.modelId === "string" ? s.modelId : null,
        enabled: s.enabled !== false,
        label: typeof s.label === "string" ? s.label : null,
      }))
    : [];

  // Use the authoritative enabledCount from the server; fall back to counting locally.
  const enabledStepCount =
    typeof stepsObj?.enabledCount === "number" ? stepsObj.enabledCount : steps.filter((s) => s.enabled).length;

  const policyNames: string[] = [];
  if (Array.isArray(d.policies)) {
    for (const p of d.policies) {
      const name = typeof p.name === "string" && p.name ? p.name : typeof p.policyId === "string" ? p.policyId : null;
      if (name && !policyNames.includes(name)) policyNames.push(name);
    }
  }

  return {
    routeName: typeof routeObj?.name === "string" ? routeObj.name : "Unnamed route",
    isPublished: routeObj?.isPublished === true,
    enabledStepCount,
    policyNames,
    steps,
    contractVersion: typeof d.contractVersion === "string" ? d.contractVersion : null,
  };
}

/** Map simulate response to ExplainResult. */
export function mapSimulateToExplainResult(args: {
  routeId: string;
  environmentId: string;
  raw: Record<string, unknown>;
  explainChain: ExplainChainSummary | null;
}): ExplainResult {
  const { routeId, environmentId, raw, explainChain } = args;
  const d = (raw?.data ?? {}) as Record<string, unknown>;

  const routingAttempts: RoutingAttemptRow[] = Array.isArray(d.routingAttempts)
    ? (d.routingAttempts as Array<Record<string, unknown>>).map((r) => ({
        stepId: String(r.stepId ?? ""),
        orderIndex: typeof r.orderIndex === "number" ? r.orderIndex : 0,
        providerType: typeof r.providerType === "string" ? r.providerType : null,
        modelId: typeof r.modelId === "string" ? r.modelId : null,
        hypotheticalOutcome: (r.hypotheticalOutcome as RoutingAttemptRow["hypotheticalOutcome"]) ?? "not_selected",
        parallelGroupId: typeof r.parallelGroupId === "string" ? r.parallelGroupId : null,
        parallelBranchRole: typeof r.parallelBranchRole === "string" ? r.parallelBranchRole : null,
      }))
    : [];

  const stepDiagnostics: StepDiagRow[] = Array.isArray(d.stepDiagnostics)
    ? (d.stepDiagnostics as Array<Record<string, unknown>>).map((s) => ({
        stepId: String(s.stepId ?? ""),
        orderIndex: typeof s.orderIndex === "number" ? s.orderIndex : 0,
        providerType: typeof s.providerType === "string" ? s.providerType : null,
        modelId: typeof s.modelId === "string" ? s.modelId : null,
        policyViolations: Array.isArray(s.policyViolations)
          ? (s.policyViolations as Array<Record<string, string>>).map((v) => ({
              policyId: String(v.policyId ?? ""),
              policyName: String(v.policyName ?? ""),
              type: String(v.type ?? ""),
              message: String(v.message ?? ""),
            }))
          : [],
        executable: s.executable === true,
      }))
    : [];

  // For 403 policy_blocked responses the server returns violations at the TOP level
  // (no `data` envelope): { error, message, violations }. Fall back to raw.violations
  // so the receipt renders "BLOCKED BY POLICY" rather than "NO STEP EXECUTABLE".
  const violationsSource = Array.isArray(d.violations)
    ? (d.violations as Array<Record<string, string>>)
    : Array.isArray((raw as Record<string, unknown>).violations)
      ? ((raw as Record<string, unknown>).violations as Array<Record<string, string>>)
      : [];
  const policyViolations = violationsSource.map((v) => ({
    policyId: String(v.policyId ?? ""),
    policyName: String(v.policyName ?? ""),
    type: String(v.type ?? ""),
    message: String(v.message ?? ""),
  }));

  const perStepEstimates = Array.isArray(d.perStepEstimates)
    ? (d.perStepEstimates as Array<Record<string, unknown>>).map((e) => ({
        stepId: String(e.stepId ?? ""),
        modelId: typeof e.modelId === "string" ? e.modelId : null,
        providerType: typeof e.providerType === "string" ? e.providerType : null,
        estimatedCostUsd: typeof e.estimatedCostUsd === "number" ? e.estimatedCostUsd : null,
        wouldRun: e.wouldRun === true,
      }))
    : [];

  return {
    kind: "explain",
    routeId,
    environmentId,
    selectedStepId: typeof d.selectedStepId === "string" ? d.selectedStepId : null,
    providerType: typeof d.providerType === "string" ? d.providerType : null,
    modelId: typeof d.modelId === "string" ? d.modelId : null,
    explanation: typeof d.explanation === "string" ? d.explanation : null,
    routingAttempts,
    stepDiagnostics,
    explainChain,
    policyViolations,
    wouldRun: d.wouldRun === true,
    perStepEstimates,
    contractVersion: typeof d.contract_version === "string" ? d.contract_version : null,
  };
}

/** Map runtime invoke response to InvokeResult. */
export function mapInvokeToResult(args: {
  routeId: string;
  environmentId: string;
  raw: Record<string, unknown>;
  latencyMs: number;
  logsHref: string;
}): InvokeResult {
  const { routeId, environmentId, raw, latencyMs, logsHref } = args;
  const d = (raw?.data ?? {}) as Record<string, unknown>;
  const usage = (d.usage ?? {}) as Record<string, unknown>;

  const runtimeSteps = Array.isArray(d.runtimeSteps)
    ? (d.runtimeSteps as Array<Record<string, unknown>>).map((s) => ({
        routeStepId: String(s.routeStepId ?? ""),
        orderIndex: typeof s.orderIndex === "number" ? s.orderIndex : 0,
        providerType: typeof s.providerType === "string" ? s.providerType : null,
        modelId: typeof s.modelId === "string" ? s.modelId : null,
        promptTokens: typeof s.promptTokens === "number" ? s.promptTokens : null,
        completionTokens: typeof s.completionTokens === "number" ? s.completionTokens : null,
        ...(s.skipped === true ? { skipped: true, skipReason: typeof s.skipReason === "string" ? s.skipReason : undefined } : {}),
      }))
    : [];

  return {
    kind: "invoke",
    routeId,
    environmentId,
    content: typeof d.content === "string" ? d.content : "",
    providerType: typeof d.providerType === "string" ? d.providerType : null,
    modelId: typeof d.modelId === "string" ? d.modelId : null,
    latencyMs,
    usage: {
      promptTokens: typeof usage.promptTokens === "number" ? usage.promptTokens : null,
      completionTokens: typeof usage.completionTokens === "number" ? usage.completionTokens : null,
      totalTokens: typeof usage.totalTokens === "number" ? usage.totalTokens : null,
    },
    estimatedCostUsd: typeof d.estimatedCostUsd === "number" ? d.estimatedCostUsd : null,
    runtimeSteps,
    requestLogHref: logsHref,
    runtimeContractVersion: typeof d.runtimeContractVersion === "string" ? d.runtimeContractVersion : null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting helpers (pure)
// ────────────────────────────────────────────────────────────────────────────

export function formatOutcomeLabel(outcome: RoutingAttemptRow["hypotheticalOutcome"]): string {
  switch (outcome) {
    case "selected": return "SELECTED";
    case "blocked_by_policy": return "BLOCKED";
    case "not_executable": return "NO KEY";
    case "not_selected": return "SKIPPED";
  }
}

export function formatCostUsd(usd: number | null): string {
  if (usd == null) return "—";
  if (usd < 0.000001) return "<$0.000001";
  return `$${usd.toFixed(6)}`;
}
