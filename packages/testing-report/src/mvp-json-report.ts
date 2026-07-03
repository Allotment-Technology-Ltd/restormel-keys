import type {
  AcceptanceCriterionResult,
  KeysModelMeta,
  RunRecord,
  SuiteReportSlice,
  Verdict,
} from "@restormel/testing-core";
import { inferFailureBucket, type FailureBucket } from "./failure-bucket.js";
import {
  GITHUB_SUMMARY_MD,
  JUNIT_XML,
  REPORT_JSON,
  RUN_JSON,
  SUMMARY_MD,
  TRACES_JSON,
  WARNINGS_TXT,
} from "./artifact-filenames.js";

export const MVP_REPORT_SCHEMA_VERSION = "1" as const;

export interface MvpGoalReportRow {
  goal_id: string;
  verdict: Verdict;
  reason_code: string;
  failure_bucket: FailureBucket;
  summary: string;
  retries_used: number;
  evidence_refs: string[];
}

export interface MvpJsonReportV1 {
  schema_version: typeof MVP_REPORT_SCHEMA_VERSION;
  generated_at: string;
  run: RunRecord;
  /** Local/CI reproduction hints (no secrets). */
  reproduction?: {
    report_command: string;
    notes?: string;
  };
  suite?: {
    id: string;
    description?: string;
    user_story?: string;
    acceptance_criteria?: { id: string; text: string }[];
    tags?: string[];
    environment_id: string;
    goal_count: number;
  };
  acceptance_results?: {
    id: string;
    text: string;
    verdict: AcceptanceCriterionResult["verdict"];
    summary?: string;
    evidence_refs: string[];
    covered_by_goal_ids: string[];
  }[];
  verdict_summary: {
    overall: Verdict;
    passed: number;
    failed: number;
    indeterminate: number;
    total: number;
  };
  goals: MvpGoalReportRow[];
  /** Relative paths inside the artefact directory. */
  artifact_files: {
    run_json: string;
    traces_json: string;
    report_json: string;
    summary_md: string;
    github_summary_md: string;
    junit_xml: string;
    warnings_txt: string;
  };
  keys_model_meta?: KeysModelMeta[];
  warnings?: string[];
}

function verdictCounts(run: RunRecord): MvpJsonReportV1["verdict_summary"] {
  let passed = 0;
  let failed = 0;
  let indeterminate = 0;
  for (const g of run.goalRuns) {
    if (g.verdict === "passed") passed++;
    else if (g.verdict === "failed") failed++;
    else indeterminate++;
  }
  return {
    overall: run.verdict,
    passed,
    failed,
    indeterminate,
    total: run.goalRuns.length,
  };
}

function goalRows(run: RunRecord): MvpGoalReportRow[] {
  return run.goalRuns.map((g) => ({
    goal_id: g.goalId,
    verdict: g.verdict,
    reason_code: g.reasonCode,
    failure_bucket: inferFailureBucket(g.reasonCode, g.verdict),
    summary: g.summary,
    retries_used: g.retriesUsed,
    evidence_refs: [...g.evidenceRefs],
  }));
}

export function buildMvpJsonReport(input: {
  run: RunRecord;
  suite?: SuiteReportSlice;
  warnings?: string[];
  generatedAt?: string;
  reproduction?: MvpJsonReportV1["reproduction"];
}): MvpJsonReportV1 {
  const { run, suite, warnings } = input;
  const generated_at = input.generatedAt ?? new Date().toISOString();

  const doc: MvpJsonReportV1 = {
    schema_version: MVP_REPORT_SCHEMA_VERSION,
    generated_at,
    run,
    verdict_summary: verdictCounts(run),
    goals: goalRows(run),
    artifact_files: {
      run_json: RUN_JSON,
      traces_json: TRACES_JSON,
      report_json: REPORT_JSON,
      summary_md: SUMMARY_MD,
      github_summary_md: GITHUB_SUMMARY_MD,
      junit_xml: JUNIT_XML,
      warnings_txt: WARNINGS_TXT,
    },
  };

  if (suite !== undefined) {
    doc.suite = {
      id: suite.id,
      description: suite.description,
      user_story: suite.userStory,
      acceptance_criteria:
        suite.acceptanceCriteria !== undefined && suite.acceptanceCriteria.length > 0
          ? suite.acceptanceCriteria.map((c) => ({ id: c.id, text: c.text }))
          : undefined,
      tags: suite.tags !== undefined && suite.tags.length > 0 ? [...suite.tags] : undefined,
      environment_id: suite.environmentId,
      goal_count: suite.goalCount,
    };
  }

  if (run.acceptanceResults !== undefined && run.acceptanceResults.length > 0) {
    doc.acceptance_results = run.acceptanceResults.map((r) => ({
      id: r.id,
      text: r.text,
      verdict: r.verdict,
      summary: r.summary,
      evidence_refs: [...r.evidenceRefs],
      covered_by_goal_ids: [...r.coveredByGoalIds],
    }));
  }

  if (run.keysModelMeta !== undefined && run.keysModelMeta.length > 0) {
    doc.keys_model_meta = run.keysModelMeta.map((m) => ({ ...m }));
  }

  if (warnings !== undefined && warnings.length > 0) {
    doc.warnings = [...warnings];
  }

  if (input.reproduction !== undefined) {
    doc.reproduction = { ...input.reproduction };
  }

  return doc;
}

export function serializeMvpJsonReport(doc: MvpJsonReportV1): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
