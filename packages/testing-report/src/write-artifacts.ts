import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolvePathUnderRoot, type RunRecord, type TraceEvent } from "@restormel/testing-core";
import {
  GITHUB_SUMMARY_MD,
  JUNIT_XML,
  REPORT_JSON,
  RUN_JSON,
  SUMMARY_MD,
  TRACES_JSON,
  WARNINGS_TXT,
} from "./artifact-filenames.js";
import { buildGithubStepSummaryMarkdown } from "./github-summary.js";
import { buildJUnitXml } from "./junit.js";
import { buildMarkdownSummary } from "./markdown-summary.js";
import { buildMvpJsonReport, serializeMvpJsonReport } from "./mvp-json-report.js";
import type { SuiteReportSlice } from "@restormel/testing-core";

export {
  GITHUB_SUMMARY_MD,
  JUNIT_XML,
  REPORT_JSON,
  RUN_JSON,
  SUMMARY_MD,
  TRACES_JSON,
  WARNINGS_TXT,
} from "./artifact-filenames.js";

export interface RunArtifactPayload {
  run: RunRecord;
  traces: TraceEvent[];
  warnings?: string[];
}

export interface RunReportBundleInput extends RunArtifactPayload {
  suite?: SuiteReportSlice;
  reproduction?: {
    report_command: string;
    notes?: string;
  };
}

export type ArtifactIoOptions = {
  /** Directory tree `dir` must stay within (default: `process.cwd()`). */
  allowedRoot?: string;
};

/**
 * Write raw run record, traces, warnings only (legacy / minimal).
 */
export async function writeRunArtifacts(
  dir: string,
  payload: RunArtifactPayload,
  options?: ArtifactIoOptions,
): Promise<void> {
  const root = options?.allowedRoot ?? process.cwd();
  const resolved = resolvePathUnderRoot(root, dir);
  if (!resolved.ok) throw new Error(resolved.reason);
  const safeDir = resolved.path;
  await mkdir(safeDir, { recursive: true });
  await writeFile(join(safeDir, RUN_JSON), `${JSON.stringify(payload.run, null, 2)}\n`, "utf8");
  await writeFile(join(safeDir, TRACES_JSON), `${JSON.stringify(payload.traces, null, 2)}\n`, "utf8");
  if (payload.warnings !== undefined && payload.warnings.length > 0) {
    await writeFile(join(safeDir, WARNINGS_TXT), `${payload.warnings.join("\n")}\n`, "utf8");
  }
}

/**
 * Full MVP artefact set: run.json, traces.json, warnings.txt, report.json, summary.md,
 * github-summary.md (generic), junit.xml.
 */
export async function writeRunReportBundle(
  dir: string,
  input: RunReportBundleInput,
  options?: ArtifactIoOptions,
): Promise<void> {
  await writeRunArtifacts(
    dir,
    {
      run: input.run,
      traces: input.traces,
      warnings: input.warnings,
    },
    options,
  );

  const mvp = buildMvpJsonReport({
    run: input.run,
    suite: input.suite,
    warnings: input.warnings,
    reproduction: input.reproduction,
  });
  await writeFile(join(dir, REPORT_JSON), serializeMvpJsonReport(mvp), "utf8");

  await writeFile(
    join(dir, SUMMARY_MD),
    buildMarkdownSummary({
      run: input.run,
      suite: input.suite,
      warnings: input.warnings,
    }),
    "utf8",
  );

  await writeFile(
    join(dir, GITHUB_SUMMARY_MD),
    buildGithubStepSummaryMarkdown({
      run: input.run,
      suite: input.suite,
      warnings: input.warnings,
    }),
    "utf8",
  );

  await writeFile(join(dir, JUNIT_XML), buildJUnitXml(input.run), "utf8");
}
