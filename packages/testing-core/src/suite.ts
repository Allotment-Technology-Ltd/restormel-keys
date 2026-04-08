import type { AcceptanceCriterionDefinition } from "./acceptance.js";
import type { ArtifactPolicy, RetryPolicy } from "./policies.js";
import type { TestGoal } from "./goal.js";

export interface TestSuite {
  id: string;
  description?: string;
  /**
   * Optional business narrative (As a … I want …). Reported prominently; not executed by the runner.
   * YAML: `user_story` / `userStory`.
   */
  userStory?: string;
  /**
   * Ordered acceptance criteria with stable ids for reports and traceability.
   * YAML: `acceptance_criteria` / `acceptanceCriteria` as `{ id, text }[]`.
   */
  acceptanceCriteria?: AcceptanceCriterionDefinition[];
  /** Id of an `EnvironmentProfile` in resolved config. */
  environment: string;
  goals: TestGoal[];
  tags?: string[];
  retryPolicy?: RetryPolicy;
  /** Default per-goal timeout (ms) when not overridden by the runner. */
  defaultTimeoutMs?: number;
  artifactPolicy?: ArtifactPolicy;
}
