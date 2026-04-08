import { describe, expect, it } from "vitest";
import {
  isGoalRunRecord,
  isReport,
  isRunRecord,
  isTraceEvent,
} from "./guards.js";
import { successCriteriaToAssertions } from "./normalize.js";
import { isVerdict, VERDICTS } from "./verdict.js";
import type { EnvironmentProfile } from "./environment.js";
import type { Report } from "./report.js";
import type { RunRecord, RunRequest, TraceEvent } from "./run.js";
import type { TestSuite } from "./suite.js";
import { testingCorePackage } from "./index.js";

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("contracts", () => {
  it("exports package id from barrel", () => {
    expect(testingCorePackage).toBe("@restormel/testing-core");
  });

  it("verdict guard accepts MVP states only", () => {
    for (const v of VERDICTS) {
      expect(isVerdict(v)).toBe(true);
    }
    expect(isVerdict("maybe")).toBe(false);
    expect(isVerdict(null)).toBe(false);
  });

});

describe("serialization", () => {
  it("round-trips RunRequest", () => {
    const req: RunRequest = {
      suiteId: "web-critical",
      environmentId: "staging",
      trigger: "ci",
      goalIds: ["dashboard-ready"],
      commitSha: "abc",
      repository: "acme/plot",
      gitRef: "refs/pull/1/merge",
    };
    expect(roundTrip(req).trigger).toBe("ci");
  });

  it("round-trips a minimal suite + environment", () => {
    const env: EnvironmentProfile = {
      id: "staging",
      baseUrl: "https://example.test",
      authMode: "storage_state",
      authRef: "env:RT_STORAGE_STATE_PATH",
      keys: {
        llm_primary: "ref:restormel-keys:llm/primary",
      },
    };
    const suite: TestSuite = {
      id: "web-critical",
      environment: "staging",
      goals: [
        {
          id: "dashboard-ready",
          type: "browser",
          description: "Dashboard loads for a signed-in user",
          successCriteria: {
            urlMatches: ["/app/dashboard", "/app/home"],
            textPresent: ["Projects"],
            judgeRubric: {
              id: "dashboard-sane",
              modelRef: "llm_primary",
              summary: "Layout OK",
            },
          },
          tags: ["smoke"],
        },
      ],
      retryPolicy: { maxRetries: 2, backoffMs: 500 },
      defaultTimeoutMs: 120_000,
      artifactPolicy: {
        screenshots: "on_failure",
        browserTrace: "on_failure",
        console: true,
      },
    };
    expect(roundTrip(env).keys?.llm_primary).toContain("ref:restormel-keys:");
    expect(roundTrip(suite).goals[0]?.successCriteria.textPresent).toEqual(["Projects"]);
  });

  it("round-trips run + report and satisfies guards", () => {
    const run: RunRecord = {
      id: "run_01",
      suiteId: "web-critical",
      environmentId: "staging",
      trigger: "ci",
      commitSha: "abc1234",
      repository: "acme/plot",
      startedAt: "2026-04-07T12:00:00.000Z",
      endedAt: "2026-04-07T12:05:00.000Z",
      verdict: "failed",
      goalRuns: [
        {
          goalId: "dashboard-ready",
          verdict: "failed",
          reasonCode: "ASSERTION_FAILED",
          summary: 'Expected text "Projects"',
          retriesUsed: 1,
          evidenceRefs: ["screenshots/dashboard.png", "trace.zip"],
        },
      ],
      keysModelMeta: [
        {
          logicalRef: "ref:restormel-keys:llm/primary",
          provider: "openai",
          model: "gpt-4.1-mini",
          invocationCount: 2,
        },
      ],
      judgeInvocationCount: 2,
      costEstimate: {
        currency: "USD",
        total: 0.004,
        tokenEstimate: { input: 1200, output: 400 },
      },
    };
    const raw = roundTrip(run);
    expect(isRunRecord(raw)).toBe(true);

    const report: Report = {
      run: raw,
      highlights: ["Goal dashboard-ready failed on text assertion"],
      artifacts: [
        { kind: "screenshot", path: "screenshots/dashboard.png", mimeType: "image/png" },
        { kind: "trace", path: "trace.zip" },
      ],
      reproduction: {
        argv: ["pnpm", "exec", "restormel-testing", "run", "--goal", "dashboard-ready"],
        cwd: ".",
        notes: "Requires RT_STORAGE_STATE_PATH",
      },
    };
    const reportRaw = roundTrip(report);
    expect(isReport(reportRaw)).toBe(true);
  });

  it("round-trips trace events", () => {
    const ev: TraceEvent = {
      id: "tr_1",
      runId: "run_01",
      goalId: "dashboard-ready",
      stepIndex: 0,
      kind: "navigation",
      timestamp: "2026-04-07T12:00:01.000Z",
      summary: "goto /app/dashboard",
      metadata: { url: "https://example.test/app/dashboard" },
    };
    const raw = roundTrip(ev);
    expect(isTraceEvent(raw)).toBe(true);
  });
});

describe("successCriteriaToAssertions", () => {
  it("normalises flat criteria to assertion atoms", () => {
    const assertions = successCriteriaToAssertions({
      urlMatches: "/ok",
      domSignals: ["#root"],
      textPresent: ["OK"],
      textAbsent: ["Error"],
      structuredChecks: [{ id: "c1", path: "$.status", expect: "ready" }],
      judgeRubric: { id: "j1" },
    });
    expect(assertions.map((a) => a.kind)).toEqual([
      "url",
      "dom",
      "text_present",
      "text_absent",
      "structured",
      "judge",
    ]);
    expect(assertions[0]).toEqual({ kind: "url", patterns: ["/ok"] });
  });
});

describe("guards reject malformed payloads", () => {
  it("isRunRecord", () => {
    expect(isRunRecord({})).toBe(false);
    expect(isRunRecord(null)).toBe(false);
    expect(
      isRunRecord({
        id: "r",
        suiteId: "s",
        environmentId: "e",
        trigger: "local",
        startedAt: "t",
        verdict: "passed",
        goalRuns: [
          {
            goalId: "g",
            verdict: "bogus",
            reasonCode: "x",
            summary: "y",
            retriesUsed: 0,
            evidenceRefs: [],
          },
        ],
      }),
    ).toBe(false);
  });

  it("isGoalRunRecord", () => {
    expect(isGoalRunRecord({ goalId: "g", verdict: "passed" })).toBe(false);
  });

  it("isTraceEvent", () => {
    expect(
      isTraceEvent({
        kind: "wat",
        id: "1",
        runId: "r",
        goalId: "g",
        stepIndex: 0,
        timestamp: "t",
        summary: "s",
      }),
    ).toBe(false);
  });

  it("isReport", () => {
    expect(isReport({ run: {}, highlights: [], artifacts: [] })).toBe(false);
    expect(
      isReport({
        run: {
          id: "r",
          suiteId: "s",
          environmentId: "e",
          trigger: "ci",
          startedAt: "t",
          verdict: "passed",
          goalRuns: [],
        },
        highlights: [],
        artifacts: [{ kind: "bad", path: "p" }],
      }),
    ).toBe(false);
  });
});
