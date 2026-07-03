import { describe, expect, it } from "vitest";
import { inferFailureBucket } from "./failure-bucket.js";
import { buildJUnitXml } from "./junit.js";
import { buildMarkdownSummary } from "./markdown-summary.js";
import { buildMvpJsonReport, MVP_REPORT_SCHEMA_VERSION } from "./mvp-json-report.js";
import {
  GITHUB_SUMMARY_MD,
  JUNIT_XML,
  REPORT_JSON,
  RUN_JSON,
  SUMMARY_MD,
  TRACES_JSON,
} from "./artifact-filenames.js";

const sampleRun = {
  id: "run-1",
  suiteId: "suite-a",
  environmentId: "local",
  trigger: "local" as const,
  startedAt: "2026-04-07T10:00:00.000Z",
  endedAt: "2026-04-07T10:00:05.000Z",
  verdict: "failed" as const,
  commitSha: "abc123",
  repository: "org/repo",
  goalRuns: [
    {
      goalId: "g1",
      verdict: "failed" as const,
      reasonCode: "TEXT_NOT_FOUND",
      summary: "missing copy",
      retriesUsed: 1,
      evidenceRefs: ["goals/g1/attempt-0.png"],
    },
    {
      goalId: "g2",
      verdict: "passed" as const,
      reasonCode: "OK",
      summary: "ok",
      retriesUsed: 0,
      evidenceRefs: [],
    },
  ],
  keysModelMeta: [
    {
      logicalRef: "ref:restormel-keys:llm/primary",
      provider: "openai",
      model: "gpt-4o-mini",
      invocationCount: 1,
      resolutionSource: "keys" as const,
    },
  ],
  judgeInvocationCount: 1,
  costEstimate: { tokenEstimate: { input: 0, output: 120 } },
};

describe("inferFailureBucket", () => {
  it("classifies assertion failures", () => {
    expect(inferFailureBucket("TEXT_NOT_FOUND", "failed")).toBe("assertion");
    expect(inferFailureBucket("OK", "passed")).toBe("none");
  });

  it("classifies adapter errors", () => {
    expect(inferFailureBucket("ADAPTER_ERROR", "failed")).toBe("adapter");
  });
});

describe("buildMvpJsonReport", () => {
  it("produces stable schema v1 shape", () => {
    const doc = buildMvpJsonReport({
      run: sampleRun,
      suite: {
        id: "suite-a",
        description: "Smoke",
        tags: ["smoke"],
        environmentId: "local",
        goalCount: 2,
      },
      warnings: ["w1"],
    });

    expect(doc.schema_version).toBe(MVP_REPORT_SCHEMA_VERSION);
    expect(doc.verdict_summary.overall).toBe("failed");
    expect(doc.verdict_summary.passed).toBe(1);
    expect(doc.verdict_summary.failed).toBe(1);
    expect(doc.goals).toHaveLength(2);
    expect(doc.goals[0]?.failure_bucket).toBe("assertion");
    expect(doc.goals[0]?.retries_used).toBe(1);
    expect(doc.suite?.id).toBe("suite-a");
    expect(doc.suite?.goal_count).toBe(2);
    expect(doc.keys_model_meta).toHaveLength(1);
    expect(doc.warnings).toEqual(["w1"]);
    expect(doc.artifact_files.run_json).toBe(RUN_JSON);
    expect(doc.artifact_files.report_json).toBe(REPORT_JSON);
    expect(doc.artifact_files.summary_md).toBe(SUMMARY_MD);
    expect(doc.artifact_files.github_summary_md).toBe(GITHUB_SUMMARY_MD);
    expect(doc.artifact_files.junit_xml).toBe(JUNIT_XML);
    expect(doc.artifact_files.traces_json).toBe(TRACES_JSON);
  });

  it("includes acceptance_results when run carries roll-up", () => {
    const doc = buildMvpJsonReport({
      run: {
        ...sampleRun,
        acceptanceResults: [
          {
            id: "ac-1",
            text: "Do thing",
            verdict: "passed",
            evidenceRefs: [],
            coveredByGoalIds: ["g1"],
          },
        ],
      },
      suite: {
        id: "suite-a",
        environmentId: "local",
        goalCount: 2,
        userStory: "As a user…",
        acceptanceCriteria: [{ id: "ac-1", text: "Do thing" }],
      },
    });
    expect(doc.acceptance_results).toHaveLength(1);
    expect(doc.acceptance_results?.[0]?.verdict).toBe("passed");
    expect(doc.suite?.user_story).toMatch(/As a user/);
    expect(doc.suite?.acceptance_criteria).toHaveLength(1);
  });

  it("includes reproduction when provided", () => {
    const doc = buildMvpJsonReport({
      run: sampleRun,
      reproduction: {
        report_command: "testing report ./out",
        notes: "re-run locally",
      },
    });
    expect(doc.reproduction?.report_command).toBe("testing report ./out");
    expect(doc.reproduction?.notes).toBe("re-run locally");
  });
});

describe("buildMarkdownSummary", () => {
  it("includes goal table and keys section", () => {
    const md = buildMarkdownSummary({ run: sampleRun, warnings: ["w1"] });
    expect(md).toContain("# Restormel Testing run");
    expect(md).toContain("`g1`");
    expect(md).toContain("assertion");
    expect(md).toContain("Keys / model metadata");
    expect(md).toContain("ref:restormel-keys:llm/primary");
    expect(md).toContain("Judge / rubric");
    expect(md).toContain("Invocation count:");
    expect(md).toContain("(factual)");
    expect(md).toContain("Rough token scale");
    expect(md).toContain("Not billing-grade");
  });
});

describe("buildJUnitXml", () => {
  it("emits testsuite with failure and passed cases", () => {
    const xml = buildJUnitXml(sampleRun);
    expect(xml).toContain('tests="2"');
    expect(xml).toContain('failures="1"');
    expect(xml).toContain("<failure ");
    expect(xml).toContain("g1");
    expect(xml).toContain("g2");
    const failureTags = xml.match(/<failure /g);
    expect(failureTags?.length).toBe(1);
  });
});
