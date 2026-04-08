/**
 * @restormel/testing-runner — local suite execution (MVP).
 */
export { runBrowserGoal } from "./browser-goal.js";
export type { RunBrowserGoalOptions, RunBrowserGoalResult } from "./browser-goal.js";
export { evaluateBrowserSuccessCriteria } from "./evaluate-criteria.js";
export type { CriteriaEvaluation } from "./evaluate-criteria.js";
export { runGoalAttempts } from "./retries.js";
export type { AttemptOutcome } from "./retries.js";
export { runLocalSuite, runSuiteFromConfig } from "./run-suite.js";
export type { RunLocalSuiteOptions, RunSuiteExecutionOptions, RunSuiteResult } from "./types.js";
export { withTimeout, TimeoutError } from "./timeout.js";
