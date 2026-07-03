import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readRunArtifacts } from "./read-artifacts.js";
import { MVP_REPORT_SCHEMA_VERSION } from "./mvp-json-report.js";
import { RUN_JSON, TRACES_JSON, writeRunReportBundle } from "./write-artifacts.js";

const minimalRun = {
  id: "run-test-1",
  suiteId: "suite-a",
  environmentId: "local",
  trigger: "local" as const,
  startedAt: "2026-04-07T12:00:00.000Z",
  endedAt: "2026-04-07T12:00:01.000Z",
  verdict: "passed" as const,
  goalRuns: [
    {
      goalId: "g1",
      verdict: "passed" as const,
      reasonCode: "OK",
      summary: "ok",
      retriesUsed: 0,
      evidenceRefs: [] as string[],
    },
  ],
};

describe("writeRunReportBundle / readRunArtifacts", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("round-trips run + traces", async () => {
    dir = await mkdtemp(join(tmpdir(), "rt-report-"));
    const trace = {
      id: "t1",
      runId: minimalRun.id,
      goalId: "g1",
      stepIndex: 0,
      kind: "observation" as const,
      timestamp: "2026-04-07T12:00:00.000Z",
      summary: "test",
    };
    await writeRunReportBundle(
      dir,
      {
        run: minimalRun,
        traces: [trace],
        warnings: ["w1"],
        suite: {
          id: "suite-a",
          environmentId: "local",
          goalCount: 1,
        },
      },
      { allowedRoot: dir },
    );

    const runJson = await readFile(join(dir, RUN_JSON), "utf8");
    expect(JSON.parse(runJson)).toMatchObject({ id: minimalRun.id });

    const tracesJson = await readFile(join(dir, TRACES_JSON), "utf8");
    expect(JSON.parse(tracesJson)).toHaveLength(1);

    const reportJson = JSON.parse(await readFile(join(dir, "report.json"), "utf8")) as {
      schema_version: string;
      goals: unknown[];
    };
    expect(reportJson.schema_version).toBe(MVP_REPORT_SCHEMA_VERSION);
    expect(reportJson.goals).toHaveLength(1);

    const junit = await readFile(join(dir, "junit.xml"), "utf8");
    expect(junit).toContain("testsuite");
    expect(junit).toContain("g1");

    const md = await readFile(join(dir, "summary.md"), "utf8");
    expect(md).toContain("# Restormel Testing run");

    const loaded = await readRunArtifacts(dir, { allowedRoot: dir });
    if (!("run" in loaded)) {
      throw new Error(loaded.message);
    }
    expect(loaded.run.id).toBe(minimalRun.id);
    expect(loaded.traces).toHaveLength(1);
    expect(loaded.warnings).toContain("w1");
  });

  it("readRunArtifacts accepts a path to run.json", async () => {
    dir = await mkdtemp(join(tmpdir(), "rt-report-"));
    await writeRunReportBundle(
      dir,
      {
        run: minimalRun,
        traces: [],
        suite: { id: "suite-a", environmentId: "local", goalCount: 1 },
      },
      { allowedRoot: dir },
    );
    const loaded = await readRunArtifacts(join(dir, RUN_JSON), { allowedRoot: dir });
    if (!("run" in loaded)) {
      throw new Error(loaded.message);
    }
    expect(loaded.run.suiteId).toBe("suite-a");
  });
});
