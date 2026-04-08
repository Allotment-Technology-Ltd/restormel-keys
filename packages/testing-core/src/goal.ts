import type { AcSequenceConfig } from "./ac-sequence.js";
import type { LlmBudget } from "./llm-budget.js";
import type { SuccessCriteria } from "./success-criteria.js";

export type GoalType = "browser" | "performance" | "native";

/**
 * - **observe** (default): navigate to `start_path`, then evaluate `success_criteria` (and optional judge) on that page.
 * - **agent**: run `mission_executor` (shell) with mission env, then open a browser and evaluate post-mission criteria (see docs).
 * - **ac_sequence**: built-in LLM browser agent walks suite `acceptance_criteria` in order (see docs).
 */
export type ExecutionMode = "observe" | "agent" | "ac_sequence";

/** Optional limits passed to `mission_executor` via `RESTORMEL_TESTING_MISSION_CONSTRAINTS` (JSON). */
export interface MissionConstraints {
  /** Suggested wall-clock budget for the executor process (ms); runner uses max of this and shell-hook timeout. */
  maxDurationMs?: number;
  /** Informational URL glob patterns the executor should respect (e.g. `http://localhost:3000/**`). */
  urlAllowlist?: string[];
}

/**
 * After `mission_executor` exits 0, navigate and evaluate these criteria (deterministic + judge).
 * If `success_criteria` is omitted, the top-level goal `success_criteria` is used for this phase.
 */
export interface AfterAgentPhase {
  startPath?: string;
  successCriteria?: SuccessCriteria;
}

/** Opaque hook identifier (script id, npm script name, etc.). */
export type HookRef = string;

export interface TestGoal {
  id: string;
  type: GoalType;
  description: string;
  successCriteria: SuccessCriteria;
  /**
   * Path relative to environment `base_url` for the initial navigation (e.g. `/login`, `dashboard/`).
   * Resolved with `new URL(startPath, baseUrl)`.
   */
  startPath?: string;
  /** Defaults to **observe**. **agent** is only valid for `type: browser`. */
  executionMode?: ExecutionMode;
  /**
   * Natural-language mission (required for **agent** mode). Passed to the executor as `RESTORMEL_TESTING_MISSION`.
   * Does not auto-run an LLM inside the runner — `mission_executor` implements the mission (e.g. your agent CLI).
   */
  mission?: string;
  /**
   * Shell command invoked in **agent** mode after preconditions. Must exit 0 before post-mission browser checks.
   */
  missionExecutor?: string;
  missionConstraints?: MissionConstraints;
  /** Overrides post-mission navigation path and/or success criteria after the executor succeeds. */
  afterAgent?: AfterAgentPhase;
  /**
   * **`execution_mode: ac_sequence` only.** Suite must declare `acceptance_criteria`.
   * YAML: `ac_sequence` / `acSequence`.
   */
  acSequence?: AcSequenceConfig;
  preconditions?: HookRef[];
  cleanup?: HookRef[];
  exclusiveWith?: string[];
  tags?: string[];
  /**
   * Links automation to suite `acceptance_criteria` ids. Used for AC roll-up and `--ac` filtering.
   * YAML: `acceptance_criterion_ids` / `acceptanceCriterionIds`.
   */
  acceptanceCriterionIds?: string[];
  /** Optional caps on LLM calls / AC rounds for this goal. YAML: `llm_budget` / `llmBudget`. */
  llmBudget?: LlmBudget;
}
