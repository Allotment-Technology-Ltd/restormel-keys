/**
 * @restormel/testing-report — run artefacts, MVP reports, and summaries.
 */
export {
  GITHUB_SUMMARY_MD,
  JUNIT_XML,
  PRE_RUN_FAILURE_JSON,
  REPORT_JSON,
  RUN_JSON,
  SUMMARY_MD,
  TRACES_JSON,
  WARNINGS_TXT,
} from "./artifact-filenames.js";
export { inferFailureBucket, type FailureBucket } from "./failure-bucket.js";
export { buildGithubStepSummaryMarkdown, type GithubSummaryContext } from "./github-summary.js";
export { buildJUnitXml } from "./junit.js";
export { buildMarkdownSummary, type MarkdownSummaryOptions } from "./markdown-summary.js";
export {
  buildMvpJsonReport,
  MVP_REPORT_SCHEMA_VERSION,
  serializeMvpJsonReport,
  type MvpGoalReportRow,
  type MvpJsonReportV1,
} from "./mvp-json-report.js";
export { formatRunSummary, formatRunSummaryLines } from "./terminal-summary.js";
export { readRunArtifacts } from "./read-artifacts.js";
export type { LoadedRunArtifacts } from "./read-artifacts.js";
export {
  writeRunArtifacts,
  writeRunReportBundle,
  type ArtifactIoOptions,
  type RunArtifactPayload,
  type RunReportBundleInput,
} from "./write-artifacts.js";
