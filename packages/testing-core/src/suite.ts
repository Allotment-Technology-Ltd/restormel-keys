import type { ArtifactPolicy, RetryPolicy } from "./policies.js";
import type { TestGoal } from "./goal.js";

export interface TestSuite {
  id: string;
  description?: string;
  /** Id of an `EnvironmentProfile` in resolved config. */
  environment: string;
  goals: TestGoal[];
  tags?: string[];
  retryPolicy?: RetryPolicy;
  /** Default per-goal timeout (ms) when not overridden by the runner. */
  defaultTimeoutMs?: number;
  artifactPolicy?: ArtifactPolicy;
}
