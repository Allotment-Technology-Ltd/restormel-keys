import { join } from "node:path";
import { formatConfigErrors, loadConfigFromFile, resolveSuite } from "@restormel/testing-config";
import { resolvePathUnderRoot } from "@restormel/testing-core";
import { keysAdapterOptionsFromProcessEnv } from "@restormel/testing-keys-adapter";
import { writeRunReportBundle } from "@restormel/testing-report";
import { runSuiteFromConfig } from "@restormel/testing-runner";
import type { PostRunsBody } from "./post-body.js";
import { logStructured } from "./logger.js";
import type { RunsStore } from "./runs-store.js";

export async function executeRunInBackground(
  store: RunsStore,
  runId: string,
  body: PostRunsBody,
  workspaceRoot: string,
): Promise<void> {
  const t0 = Date.now();
  let outcome = "incomplete";
  let verdict: string | undefined;

  try {
    const cfgRel = body.config_path ?? "restormel-testing.yaml";
    const pathRes = resolvePathUnderRoot(workspaceRoot, cfgRel);
    if (!pathRes.ok) {
      outcome = "bad_config_path";
      await store.patch(runId, {
        status: "error",
        ended_at: new Date().toISOString(),
        error_message: pathRes.reason,
        summary: "Invalid config path",
      });
      return;
    }

    await store.patch(runId, { status: "running", started_at: new Date().toISOString() });

    try {
      const loaded = await loadConfigFromFile(pathRes.path, { allowedRoot: workspaceRoot });
      if (!loaded.ok) {
        outcome = "config_invalid";
        await store.patch(runId, {
          status: "error",
          ended_at: new Date().toISOString(),
          error_message: formatConfigErrors(loaded.errors),
          summary: "Config validation failed",
        });
        return;
      }

      const suiteRes = resolveSuite(loaded.config, body.suite_id);
      if (!suiteRes.ok) {
        outcome = "suite_not_found";
        await store.patch(runId, {
          status: "error",
          ended_at: new Date().toISOString(),
          error_message: formatConfigErrors(suiteRes.errors),
          summary: "Suite not found",
        });
        return;
      }

      const goalTotal =
        body.goal_ids !== undefined && body.goal_ids.length > 0
          ? body.goal_ids.length
          : suiteRes.suite.goals.length;
      await store.patch(runId, { goal_total: goalTotal, goal_completed: 0 });

      const artifactDir = join(workspaceRoot, ".restormel-testing", "runs-api", runId);
      const result = await runSuiteFromConfig({
        config: loaded.config,
        suiteId: body.suite_id,
        environmentId: body.environment_id,
        targetUrlOverride: body.target_url,
        goalIds: body.goal_ids,
        trigger: "ci",
        commitSha: body.commit_sha,
        repository: body.repository,
        artifactDir,
        keysAdapterOptions: keysAdapterOptionsFromProcessEnv(),
        headless: true,
        configFilePath: pathRes.path,
      });

      if (!result.ok || result.run === undefined) {
        outcome = "runner_no_record";
        await store.patch(runId, {
          status: "error",
          ended_at: new Date().toISOString(),
          error_message: result.errors.join("\n") || "Runner failed",
          summary: "Run did not produce a record",
          artifact_dir: artifactDir,
        });
        return;
      }

      const run = result.run;
      verdict = run.verdict;
      const status = verdict === "passed" ? "passed" : verdict === "failed" ? "failed" : "indeterminate";
      const failedGoal = run.goalRuns.find((g) => g.verdict !== "passed");
      const summary =
        failedGoal !== undefined
          ? `${failedGoal.goalId}: ${failedGoal.summary}`
          : `All ${run.goalRuns.length} goal(s) passed`;

      await writeRunReportBundle(
        artifactDir,
        {
          run,
          traces: result.traces,
          warnings: result.warnings.length > 0 ? result.warnings : undefined,
          suite: result.suiteMeta,
          reproduction: {
            report_command: `testing report ${artifactDir}`,
            notes: `restormel-testing-runs-server workspace ${workspaceRoot}`,
          },
        },
        { allowedRoot: workspaceRoot },
      );

      await store.patch(runId, {
        status,
        ended_at: new Date().toISOString(),
        verdict,
        summary,
        goal_completed: run.goalRuns.length,
        artifact_dir: artifactDir,
      });
      outcome = status;
    } catch (e) {
      outcome = "exception";
      const msg = e instanceof Error ? e.message : String(e);
      await store.patch(runId, {
        status: "error",
        ended_at: new Date().toISOString(),
        error_message: msg,
        summary: "Unexpected runner error",
      });
    }
  } finally {
    logStructured("info", "runs_api.run_finished", {
      run_id: runId,
      outcome,
      ...(verdict !== undefined ? { verdict } : {}),
      wall_ms: Date.now() - t0,
    });
  }
}
