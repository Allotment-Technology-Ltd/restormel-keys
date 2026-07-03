import type { JudgeRubric, SuccessCriteria } from "./success-criteria.js";
import type { Verdict } from "./verdict.js";

/** Built-in LLM agent settings for `execution_mode: ac_sequence`. */
export interface AcSequenceBuiltInAgent {
  /**
   * Keys logical ref (e.g. `ref:restormel-keys:llm/primary`) or env slot name (`llm_primary`).
   * Resolved like `judge_rubric.model_ref`.
   */
  modelRef?: string;
  /** Max model rounds per acceptance criterion (default 12). */
  maxRoundsPerCriterion?: number;
  /** Extra system instructions (no secrets). */
  instructions?: string;
}

export interface AcSequencePostCheckHttp {
  /** Absolute URL or path relative to environment `base_url`. */
  url: string;
  /** Default GET. */
  method?: string;
  /** Pass if response status is in this list (default [200]). */
  expectStatus?: number[];
  /** Optional headers (do not put secrets in YAML). */
  headers?: Record<string, string>;
  /** Request body for non-GET methods. */
  body?: string;
}

/** Playwright `getByRole`-style check (less brittle than raw CSS). */
export interface AcSequencePostCheckDomRoleName {
  role: string;
  /** Optional accessible name (substring match). */
  name?: string;
  expectVisible?: boolean;
}

export interface AcSequencePostCheck {
  /** Must match a suite `acceptance_criteria[].id`. */
  acId: string;
  http?: AcSequencePostCheckHttp;
  domRoleName?: AcSequencePostCheckDomRoleName;
  /**
   * Runs as a shell hook with AC env (`RESTORMEL_TESTING_AC_ID`, etc.).
   * Product DB checks belong in your script — the runner does not open DB sockets from YAML.
   */
  dbShell?: string;
}

export interface AcSequenceConfig {
  builtInAgent: AcSequenceBuiltInAgent;
  /** Optional shell before each criterion’s agent loop (same cwd as other hooks). */
  criterionExecutor?: string;
  /** Deterministic gates after the agent (and optional judge), keyed by AC id. */
  criterionSuccess?: Record<string, SuccessCriteria>;
  /** Per-AC judge rubrics (structured JSON includes `ac_id`). */
  criterionRubrics?: Record<string, JudgeRubric>;
  postChecks?: AcSequencePostCheck[];
}

/** One row per suite acceptance criterion executed inside an `ac_sequence` goal. */
export interface AcSequenceStepResult {
  criterionId: string;
  verdict: Verdict;
  reasonCode: string;
  summary: string;
  agentRoundsUsed: number;
  evidenceRefs: string[];
}
