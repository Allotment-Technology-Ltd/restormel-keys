import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sanitizePathSegment } from "@restormel/testing-core";
import { keysAdapterOptionsFromProcessEnv } from "@restormel/testing-keys-adapter";
import { buildGithubStepSummaryMarkdown, writeRunReportBundle } from "@restormel/testing-report";
import { runLocalSuite } from "@restormel/testing-runner";
import { shouldSkipForkPr, type ForkPrPolicy } from "./fork-policy.js";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

function getenv(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v.trim() === "" ? undefined : v;
}

function appendSummary(line: string): void {
  const p = process.env.GITHUB_STEP_SUMMARY;
  if (p) {
    appendFileSync(p, `${line}\n`, "utf8");
  }
}

function appendOutput(pairs: Record<string, string>): void {
  const p = process.env.GITHUB_OUTPUT;
  if (!p) return;
  for (const [k, v] of Object.entries(pairs)) {
    appendFileSync(p, `${k}=${v}\n`, "utf8");
  }
}

function parseForkPolicy(raw: string | undefined): ForkPrPolicy {
  const v = (raw ?? "skip").toLowerCase();
  return v === "run" ? "run" : "skip";
}

/**
 * CI entrypoint driven by environment variables (set from `action.yml`).
 * Inline execution only — no polling or hosted control plane.
 */
export async function runCiFromEnv(): Promise<number> {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const policy = parseForkPolicy(getenv("RESTORMEL_TESTING_FORK_PR_POLICY"));
  const forkRaw = getenv("RESTORMEL_TESTING_IS_FORK_PR")?.trim().toLowerCase();
  const isForkPr = forkRaw === "true" || forkRaw === "1" || forkRaw === "yes";

  if (shouldSkipForkPr(policy, isForkPr)) {
    appendSummary("## Restormel Testing");
    appendSummary("");
    appendSummary("**Status:** skipped (fork PR safe mode)");
    appendSummary("");
    appendSummary(
      "This workflow run targets a **fork** pull request. By default the action does not run browser suites so you are not surprised by missing secrets or unreachable private preview URLs.",
    );
    appendSummary("");
    appendSummary(
      "To run on forks anyway, set input `fork_pr_policy: run` and ensure the suite uses only **public** targets and **no repository secrets**.",
    );
    appendSummary("");
    appendSummary(
      "Prefer `pull_request` (not `pull_request_target`) unless you fully understand the security model.",
    );
    appendOutput({ verdict: "skipped", run_id: "", skipped: "true" });
    return EXIT_OK;
  }

  const wd = getenv("RESTORMEL_TESTING_WORKING_DIRECTORY") ?? ".";
  const root = join(workspace, wd);
  process.chdir(root);

  const suitesCsv = getenv("RESTORMEL_TESTING_SUITES")?.trim();
  const suiteSingle = getenv("RESTORMEL_TESTING_SUITE")?.trim();
  const suiteList: string[] = suitesCsv
    ? suitesCsv
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : suiteSingle
      ? [suiteSingle]
      : [];
  if (suiteList.length === 0) {
    console.error("Set `suite` or comma-separated `suites` input when the action runs.");
    appendSummary("## Restormel Testing");
    appendSummary("**Error:** `suite` or `suites` is required.");
    appendOutput({ verdict: "error", run_id: "", skipped: "false" });
    return EXIT_USAGE;
  }

  const configPath = getenv("RESTORMEL_TESTING_CONFIG") ?? "restormel-testing.yaml";
  const environmentId = getenv("RESTORMEL_TESTING_ENVIRONMENT");
  const targetUrl = getenv("RESTORMEL_TESTING_TARGET_URL");
  const commitSha = getenv("RESTORMEL_TESTING_COMMIT_SHA") ?? process.env.GITHUB_SHA;
  const repository = getenv("RESTORMEL_TESTING_REPOSITORY") ?? process.env.GITHUB_REPOSITORY;
  const prNumber = getenv("RESTORMEL_TESTING_PR_NUMBER");

  const pollHint = getenv("RESTORMEL_TESTING_POLL_INTERVAL_SECONDS");
  const timeoutHint = getenv("RESTORMEL_TESTING_TIMEOUT_MINUTES");
  if (pollHint !== undefined || timeoutHint !== undefined) {
    console.warn(
      "Note: poll_interval_seconds and timeout_minutes are ignored for the inline MVP; use the job / workflow timeout instead.",
    );
  }

  const baseArtifactDir =
    getenv("RESTORMEL_TESTING_ARTIFACT_DIR") ??
    join(workspace, ".restormel-testing", "runs", `gha-${process.env.GITHUB_RUN_ID ?? "local"}-${process.env.GITHUB_RUN_ATTEMPT ?? "0"}`);

  mkdirSync(baseArtifactDir, { recursive: true });

  const keysAdapterOptions = keysAdapterOptionsFromProcessEnv();
  const repoHint = repository ?? "org/repo";

  let lastRunId = "";
  let aggregateVerdict: "passed" | "failed" | "indeterminate" = "passed";

  for (let i = 0; i < suiteList.length; i++) {
    const suite = suiteList[i]!;
    const safe = sanitizePathSegment(suite) || `suite-${i}`;
    const artifactDir = join(baseArtifactDir, safe);
    mkdirSync(artifactDir, { recursive: true });

    const result = await runLocalSuite({
      configPath,
      suiteId: suite,
      environmentId,
      targetUrlOverride: targetUrl,
      commitSha,
      repository,
      trigger: "ci",
      artifactDir,
      headless: true,
      keysAdapterOptions,
    });

    if (!result.ok || result.run === undefined) {
      appendSummary("## Restormel Testing");
      appendSummary("");
      appendSummary(`**Suite:** \`${suite}\` — error (config or runner failure)`);
      appendSummary("");
      appendSummary("```text");
      appendSummary(result.errors.join("\n") || "(no message)");
      appendSummary("```");
      appendOutput({ verdict: "error", run_id: "", skipped: "false" });
      for (const w of result.warnings) console.warn(w);
      return EXIT_USAGE;
    }

    const run = result.run;
    lastRunId = run.id;
    if (run.verdict === "failed") {
      aggregateVerdict = "failed";
    } else if (run.verdict === "indeterminate" && aggregateVerdict === "passed") {
      aggregateVerdict = "indeterminate";
    }

    let reproduce = `testing run --suite ${suite} --config ${configPath} --ci`;
    if (environmentId !== undefined) reproduce += ` --environment ${environmentId}`;
    if (targetUrl !== undefined) reproduce += ` --target-url '${targetUrl.replace(/'/g, "'\\''")}'`;
    reproduce += ` --commit-sha <sha> --repository ${repoHint}`;

    await writeRunReportBundle(artifactDir, {
      run,
      traces: result.traces,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
      suite: result.suiteMeta,
      reproduction: {
        report_command: `testing report ${artifactDir}`,
        notes: reproduce,
      },
    });

    const summaryMd = buildGithubStepSummaryMarkdown({
      run,
      suite: result.suiteMeta,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
      ciContext: { prNumber, targetUrl },
      reproduceCommand: reproduce,
      artifactDirHint: artifactDir,
    });

    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      appendFileSync(summaryPath, suiteList.length > 1 ? `### Suite \`${suite}\`\n\n${summaryMd}\n\n` : `${summaryMd}\n`, "utf8");
    }

    for (const w of result.warnings) console.warn(w);
  }

  if (suiteList.length > 1) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      appendFileSync(
        summaryPath,
        `\n---\n\n**Multi-suite:** ${suiteList.length} suite(s). Base artefact dir: \`${baseArtifactDir}\`. Aggregate verdict: **${aggregateVerdict}**.\n`,
        "utf8",
      );
    }
  }

  appendOutput({ verdict: aggregateVerdict, run_id: lastRunId, skipped: "false" });

  if (aggregateVerdict !== "passed") {
    return EXIT_FAILED;
  }
  return EXIT_OK;
}
