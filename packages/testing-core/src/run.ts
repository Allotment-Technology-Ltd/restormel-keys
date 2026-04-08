import type { AcSequenceStepResult } from "./ac-sequence.js";
import type { AcceptanceCriterionDefinition, AcceptanceCriterionResult } from "./acceptance.js";
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
  /** Sum of provider-reported prompt tokens when the API returned `usage` (OpenAI-compatible). */
  promptTokens?: number;
  /** Sum of provider-reported completion tokens. */
  completionTokens?: number;
}

export interface CostEstimate {
  /** ISO currency when known */
  currency?: string;
  total?: number;
  /**
   * Aggregated from OpenAI-compatible `usage` on chat completions when present.
   * Not all providers return usage; see `usageSource` and `tokenEstimate`.
   */
  tokenUsage?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  /** How `tokenUsage` / `tokenEstimate` should be interpreted for this run. */
  usageSource?: "provider" | "estimate" | "mixed";
  /**
   * MVP rough scale only — **not** billing-grade when provider usage is missing.
   * Used as fallback for calls without `usage` in the response body.
   */
  tokenEstimate?: {
    input?: number;
    output?: number;
  };
  /** Suite runner accounting (wall clock and LLM counters). */
  suiteExecution?: {
    wallClockMs: number;
    llmCompletions: number;
    acAgentRounds: number;
  };
}

/** Suite context embedded in reports (no secrets). */
export interface SuiteReportSlice {
  id: string;
  description?: string;
  /** Echo of suite `user_story` for human reports. */
  userStory?: string;
  /** Echo of suite `acceptance_criteria` definitions (id + text only). */
  acceptanceCriteria?: AcceptanceCriterionDefinition[];
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
  /** Copied from config for acceptance-criterion roll-up. */
  acceptanceCriterionIds?: string[];
  /** Populated by `execution_mode: ac_sequence` goals — one entry per suite criterion attempted. */
  acSequenceSteps?: AcSequenceStepResult[];
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
  /**
   * When the suite declares `acceptance_criteria`, rolled up from goals via `acceptance_criterion_ids`.
   */
  acceptanceResults?: AcceptanceCriterionResult[];
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
