import type { Verdict } from "./verdict.js";

export type RunTrigger = "local" | "ci";

/** Input to execute a suite (or subset) in local or CI. */
export interface RunRequest {
  suiteId: string;
  environmentId: string;
  trigger: RunTrigger;
  /** Run only these goals; omit for full suite. */
  goalIds?: string[];
  commitSha?: string;
  /** Repository slug for CI context (e.g. org/name). */
  repository?: string;
  gitRef?: string;
}

/** Provider/model resolution as observed during the run (no secrets). */
export interface KeysModelMeta {
  logicalRef: string;
  provider?: string;
  model?: string;
  invocationCount?: number;
  /** Populated by the keys-adapter: Keys path vs documented env fallback. */
  resolutionSource?: "keys" | "env_fallback";
}

export interface CostEstimate {
  /** ISO currency when known */
  currency?: string;
  total?: number;
  /**
   * MVP rough scale only — **not** billing-grade or provider-reported usage.
   * Prefer `RunRecord.judgeInvocationCount` for a factual rubric call count.
   */
  tokenEstimate?: {
    input?: number;
    output?: number;
  };
}

/** Suite context embedded in reports (no secrets). */
export interface SuiteReportSlice {
  id: string;
  description?: string;
  tags?: string[];
  environmentId: string;
  goalCount: number;
}

export interface GoalRunRecord {
  goalId: string;
  verdict: Verdict;
  /** Stable machine code for automation (e.g. ASSERTION_FAILED, FLAKE_TIMEOUT). */
  reasonCode: string;
  summary: string;
  retriesUsed: number;
  /** Paths or ids relative to the run artefact root. */
  evidenceRefs: string[];
}

export interface RunRecord {
  id: string;
  suiteId: string;
  environmentId: string;
  trigger: RunTrigger;
  commitSha?: string;
  repository?: string;
  startedAt: string;
  endedAt?: string;
  verdict: Verdict;
  goalRuns: GoalRunRecord[];
  /** Models touched via Keys for this run. */
  keysModelMeta?: KeysModelMeta[];
  /**
   * Total judge / `judge_rubric` model invocations in this run (sum of `keysModelMeta` invocation counts).
   * Factual; use this instead of inferring cost from {@link costEstimate}.
   */
  judgeInvocationCount?: number;
  costEstimate?: CostEstimate;
}

export type TraceEventKind =
  | "navigation"
  | "action"
  | "assertion"
  | "model_call"
  | "tool_call"
  | "observation"
  | "error";

export interface TraceEvent {
  id: string;
  runId: string;
  goalId: string;
  stepIndex: number;
  kind: TraceEventKind;
  timestamp: string;
  summary: string;
  metadata?: Record<string, unknown>;
}
