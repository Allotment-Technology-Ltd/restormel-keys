/**
 * Optional LLM / cost guardrails (YAML `llm_budget` / `llmBudget`).
 * Suite-level caps apply to the whole `testing run` for one suite; goal-level caps apply per goal.
 */
export interface LlmBudget {
  /**
   * Suite: max total **ac_sequence** agent LLM turns (one turn = one chat completion in the built-in loop).
   * Goal: overrides `ac_sequence.built_in_agent.max_rounds_per_criterion` for that goal only (per-criterion cap).
   */
  maxRounds?: number;
  /** Suite only — wall-clock ms from suite start until the runner finishes (checked between goals and before each LLM call). */
  maxWallClockMs?: number;
  /** Max chat completion requests (judges + AC agent + AC rubric judges) in scope. */
  maxCompletions?: number;
}
