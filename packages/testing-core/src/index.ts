/**
 * @restormel/testing-core — canonical domain contracts for Restormel / Testing (MVP).
 */
export const testingCorePackage = "@restormel/testing-core" as const;

export {
  isGoalRunRecord,
  isReport,
  isRunRecord,
  isTraceEvent,
} from "./guards.js";
export { isVerdict, VERDICTS } from "./verdict.js";
export { successCriteriaToAssertions } from "./normalize.js";

export type { Assertion } from "./assertion.js";
export type {
  DomAssertion,
  JudgeAssertion,
  StructuredAssertion,
  TextAbsentAssertion,
  TextPresentAssertion,
  UrlAssertion,
} from "./assertion.js";
export type {
  AcSequenceBuiltInAgent,
  AcSequenceConfig,
  AcSequencePostCheck,
  AcSequencePostCheckDomRoleName,
  AcSequencePostCheckHttp,
  AcSequenceStepResult,
} from "./ac-sequence.js";
export type {
  AcceptanceCriterionDefinition,
  AcceptanceCriterionResult,
  AcceptanceCriterionVerdict,
} from "./acceptance.js";
export { aggregateAcceptanceCriterionResults } from "./acceptance.js";
export type { EnvironmentProfile } from "./environment.js";
export type {
  AfterAgentPhase,
  ExecutionMode,
  GoalType,
  HookRef,
  MissionConstraints,
  TestGoal,
} from "./goal.js";
export type { ArtifactPolicy, RetryPolicy } from "./policies.js";
export type {
  ArtifactRef,
  ReproductionHint,
  Report,
  RunReport,
} from "./report.js";
export type {
  CostEstimate,
  GoalRunRecord,
  KeysModelMeta,
  RunRecord,
  RunRequest,
  RunTrigger,
  SuiteReportSlice,
  TraceEvent,
  TraceEventKind,
} from "./run.js";
export type { JudgeRubric, StructuredCheck, SuccessCriteria } from "./success-criteria.js";
export type { TestSuite } from "./suite.js";
export type { Verdict } from "./verdict.js";

export {
  isPathContainedInRoot,
  resolvePathUnderRoot,
  sanitizePathSegment,
} from "./safe-path.js";
export type { ResolvePathUnderRootResult } from "./safe-path.js";

/** Doc-aligned alias for `RunRecord`. */
export type TestRun = import("./run.js").RunRecord;
