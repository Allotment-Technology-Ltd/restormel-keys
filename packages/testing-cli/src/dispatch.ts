import { access, constants, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { resolvePathUnderRoot, sanitizePathSegment } from "@restormel/testing-core";
import { formatConfigErrors, loadConfigFromFile } from "@restormel/testing-config";
import { keysAdapterOptionsFromProcessEnv } from "@restormel/testing-keys-adapter";
import {
  formatRunSummary,
  PRE_RUN_FAILURE_JSON,
  readRunArtifacts,
  writeRunReportBundle,
} from "@restormel/testing-report";
import type { GoalRunRecord } from "@restormel/testing-core";
import { runLocalSuite } from "@restormel/testing-runner";
import { runDoctor } from "./doctor.js";
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE } from "./exit-codes.js";
import { printCommandHelp, printGlobalHelp } from "./help.js";
import { parseArgs, type ParsedCli } from "./parse-args.js";
import { STARTER_CONFIG_YAML } from "./starter-config.js";
import {
  countGoalVerdicts,
  getTelemetryStatus,
  isTelemetrySendingEnabled,
  maybeShowFirstRunTelemetryNotice,
  sendTelemetrySnapshot,
  setTelemetrySendingEnabled,
  telemetryUserConfigPath,
  type TelemetrySnapshot,
} from "./telemetry.js";
import { cliPackageVersion } from "./version.js";

type CliResult = { code: number; telemetry?: TelemetrySnapshot };

function emptyTelemetrySnapshot(command: TelemetrySnapshot["command"]): TelemetrySnapshot {
  return {
    command,
    suiteCount: 0,
    goalCount: 0,
    verdictPassed: 0,
    verdictFailed: 0,
    verdictIndeterminate: 0,
  };
}

function runTelemetrySnapshot(suiteCount: number, goalRuns: GoalRunRecord[]): TelemetrySnapshot {
  const v = countGoalVerdicts(goalRuns);
  return {
    command: "run",
    suiteCount,
    goalCount: goalRuns.length,
    verdictPassed: v.passed,
    verdictFailed: v.failed,
    verdictIndeterminate: v.indeterminate,
  };
}

function programLabel(): string {
  const exe = process.argv[1];
  if (!exe) return "testing";
  const base = basename(exe, ".js");
  return base === "restormel-testing" ? "restormel-testing" : "testing";
}

async function cmdInit(opts: { config: string; print: boolean; force: boolean }): Promise<number> {
  const program = programLabel();
  if (opts.print) {
    process.stdout.write(STARTER_CONFIG_YAML);
    return EXIT_OK;
  }

  const resolved = resolvePathUnderRoot(process.cwd(), opts.config);
  if (!resolved.ok) {
    console.error(`${program} init: ${resolved.reason}`);
    return EXIT_USAGE;
  }
  const configPath = resolved.path;

  if (!opts.force) {
    try {
      await access(configPath, constants.F_OK);
      console.error(`${program} init: file already exists: ${opts.config}`);
      console.error(`Use --force to overwrite, or --print to view the template.`);
      return EXIT_USAGE;
    } catch {
      /* absent */
    }
  }

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, STARTER_CONFIG_YAML, "utf8");
  console.log(`Wrote ${opts.config}`);
  return EXIT_OK;
}

async function cmdValidate(opts: { config: string; json: boolean }): Promise<CliResult> {
  const loaded = await loadConfigFromFile(opts.config);
  if (!loaded.ok) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, errors: loaded.errors }, null, 2));
    } else {
      console.error(formatConfigErrors(loaded.errors));
    }
    return { code: EXIT_USAGE, telemetry: emptyTelemetrySnapshot("validate") };
  }
  const suiteCount = loaded.config.suites.length;
  const goalCount = loaded.config.suites.reduce((n, s) => n + s.goals.length, 0);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          schema_version: loaded.config.schemaVersion,
          config_path: opts.config,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Valid ${opts.config} (schema_version ${loaded.config.schemaVersion})`);
  }
  return {
    code: EXIT_OK,
    telemetry: {
      command: "validate",
      suiteCount,
      goalCount,
      verdictPassed: 0,
      verdictFailed: 0,
      verdictIndeterminate: 0,
    },
  };
}

function defaultArtifactDir(): string {
  const slug = new Date().toISOString().replace(/[:.]/g, "-");
  return join(process.cwd(), ".restormel-testing", "runs", `run-${slug}`);
}

type RunCliOpts = {
  config: string;
  environmentId?: string;
  targetUrl?: string;
  commitSha?: string;
  repository?: string;
  artifactDir?: string;
  headless: boolean;
  trigger: "local" | "ci";
  goalIds?: string[];
  acceptanceCriterionIds?: string[];
  json: boolean;
};

async function cmdRunOneSuite(
  suiteId: string,
  artifactDir: string,
  opts: RunCliOpts,
): Promise<{ code: number; run?: import("@restormel/testing-core").RunRecord; artifactDir: string }> {
  await mkdir(artifactDir, { recursive: true });
  const keysAdapterOptions = keysAdapterOptionsFromProcessEnv();
  const result = await runLocalSuite({
    configPath: opts.config,
    suiteId,
    environmentId: opts.environmentId,
    targetUrlOverride: opts.targetUrl,
    commitSha: opts.commitSha,
    repository: opts.repository,
    trigger: opts.trigger,
    artifactDir,
    headless: opts.headless,
    goalIds: opts.goalIds,
    acceptanceCriterionIds: opts.acceptanceCriterionIds,
    keysAdapterOptions,
  });

  if (!result.ok) {
    const failureDoc = {
      ok: false as const,
      phase: "pre_run" as const,
      errors: result.errors,
    };
    await writeFile(join(artifactDir, PRE_RUN_FAILURE_JSON), JSON.stringify(failureDoc, null, 2), "utf8");
    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            suite_id: suiteId,
            errors: result.errors,
            artifact_dir: artifactDir,
            partial_artifacts: [PRE_RUN_FAILURE_JSON],
          },
          null,
          2,
        ),
      );
    } else {
      console.error(`[${suiteId}] ${result.errors.join("\n")}`);
      console.error(`Partial artefacts: ${artifactDir} (${PRE_RUN_FAILURE_JSON})`);
    }
    for (const w of result.warnings) console.warn(w);
    return { code: EXIT_USAGE, artifactDir };
  }

  const run = result.run;
  if (!run) {
    console.error("Internal error: missing run record.");
    return { code: EXIT_FAILED, artifactDir };
  }

  const program = programLabel();
  let reproduceRun = `${program} run --suite ${suiteId} --config ${opts.config}`;
  if (opts.environmentId !== undefined) reproduceRun += ` --environment ${opts.environmentId}`;
  if (opts.goalIds !== undefined && opts.goalIds.length > 0) {
    reproduceRun += ` --goal ${opts.goalIds.join(",")}`;
  }
  if (opts.acceptanceCriterionIds !== undefined && opts.acceptanceCriterionIds.length > 0) {
    reproduceRun += ` --ac ${opts.acceptanceCriterionIds.join(",")}`;
  }

  await writeRunReportBundle(artifactDir, {
    run,
    traces: result.traces,
    warnings: result.warnings.length ? result.warnings : undefined,
    suite: result.suiteMeta,
    reproduction: {
      report_command: `${program} report ${artifactDir}`,
      notes: `Re-run suite: ${reproduceRun}`.trim(),
    },
  });

  for (const w of result.warnings) console.warn(w);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          verdict: run.verdict,
          run_id: run.id,
          artifact_dir: artifactDir,
          suite_id: run.suiteId,
          environment_id: run.environmentId,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n=== Suite ${suiteId} ===`);
    console.log(formatRunSummary(run));
    console.log(
      `\nArtefacts: ${artifactDir}\n  (run.json, traces.json, report.json, summary.md, github-summary.md, junit.xml)`,
    );
  }

  if (run.verdict !== "passed") {
    return { code: EXIT_FAILED, run, artifactDir };
  }
  return { code: EXIT_OK, run, artifactDir };
}

async function cmdRun(opts: RunCliOpts & { suites: string[] }): Promise<CliResult> {
  const cwd = process.cwd();
  const { suites, ...rest } = opts;

  if (suites.length === 1) {
    let artifactDir: string;
    if (opts.artifactDir !== undefined) {
      const ar = resolvePathUnderRoot(cwd, opts.artifactDir);
      if (!ar.ok) {
        console.error(ar.reason);
        return { code: EXIT_USAGE, telemetry: runTelemetrySnapshot(suites.length, []) };
      }
      artifactDir = ar.path;
    } else {
      artifactDir = defaultArtifactDir();
    }
    const one = await cmdRunOneSuite(suites[0]!, artifactDir, rest);
    const goalRuns = one.run?.goalRuns ?? [];
    return { code: one.code, telemetry: runTelemetrySnapshot(suites.length, goalRuns) };
  }

  let baseDir: string;
  if (opts.artifactDir !== undefined) {
    const ar = resolvePathUnderRoot(cwd, opts.artifactDir);
    if (!ar.ok) {
      console.error(ar.reason);
      return { code: EXIT_USAGE, telemetry: runTelemetrySnapshot(suites.length, []) };
    }
    baseDir = ar.path;
  } else {
    baseDir = defaultArtifactDir();
  }
  await mkdir(baseDir, { recursive: true });

  const program = programLabel();
  const rows: {
    suite_id: string;
    verdict: string;
    run_id: string;
    artifact_dir: string;
  }[] = [];
  let worst = EXIT_OK;
  const allGoalRuns: GoalRunRecord[] = [];

  for (let i = 0; i < suites.length; i++) {
    const suiteId = suites[i]!;
    const safe = sanitizePathSegment(suiteId) || `suite-${i}`;
    const subDir = join(baseDir, safe);
    const r = await cmdRunOneSuite(suiteId, subDir, { ...rest, json: false });
    if (r.run) {
      allGoalRuns.push(...r.run.goalRuns);
    }
    if (r.code === EXIT_USAGE) {
      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              ok: false,
              multi: true,
              base_artifact_dir: baseDir,
              failed_at: suiteId,
            },
            null,
            2,
          ),
        );
      }
      return { code: EXIT_USAGE, telemetry: runTelemetrySnapshot(suites.length, allGoalRuns) };
    }
    if (r.run) {
      rows.push({
        suite_id: r.run.suiteId,
        verdict: r.run.verdict,
        run_id: r.run.id,
        artifact_dir: subDir,
      });
    }
    if (r.code !== EXIT_OK) worst = EXIT_FAILED;
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          ok: worst === EXIT_OK,
          multi: true,
          verdict: worst === EXIT_OK ? "passed" : "failed",
          base_artifact_dir: baseDir,
          suites: rows,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\nMulti-suite run complete (${suites.length} suites). Base: ${baseDir}`);
    console.log(`Re-run: ${program} run ${suites.map((s) => `--suite ${s}`).join(" ")} --config ${opts.config}`);
  }

  return { code: worst, telemetry: runTelemetrySnapshot(suites.length, allGoalRuns) };
}

async function cmdReport(opts: { path: string }): Promise<CliResult> {
  const loaded = await readRunArtifacts(opts.path);
  if (!("run" in loaded)) {
    console.error(loaded.message);
    return { code: EXIT_USAGE, telemetry: emptyTelemetrySnapshot("report") };
  }
  console.log(formatRunSummary(loaded.run));
  if (loaded.warnings.length > 0) {
    console.warn("Warnings from run:");
    for (const w of loaded.warnings) console.warn(`  ${w}`);
  }
  const v = countGoalVerdicts(loaded.run.goalRuns);
  return {
    code: EXIT_OK,
    telemetry: {
      command: "report",
      suiteCount: 1,
      goalCount: loaded.run.goalRuns.length,
      verdictPassed: v.passed,
      verdictFailed: v.failed,
      verdictIndeterminate: v.indeterminate,
    },
  };
}

async function cmdDoctorWithTelemetry(opts: { config?: string }): Promise<CliResult> {
  const code = await runDoctor(opts);
  let suiteCount = 0;
  let goalCount = 0;
  if (opts.config !== undefined) {
    const loaded = await loadConfigFromFile(opts.config);
    if (loaded.ok) {
      suiteCount = loaded.config.suites.length;
      goalCount = loaded.config.suites.reduce((n, s) => n + s.goals.length, 0);
    }
  }
  return {
    code,
    telemetry: {
      command: "doctor",
      suiteCount,
      goalCount,
      verdictPassed: 0,
      verdictFailed: 0,
      verdictIndeterminate: 0,
    },
  };
}

async function cmdTelemetry(
  action: "status" | "disable" | "enable",
  program: string,
): Promise<number> {
  const prefPath = telemetryUserConfigPath();
  if (action === "status") {
    const s = await getTelemetryStatus();
    console.log(`${program}: telemetry ${s.sending ? "enabled" : "disabled"}`);
    console.log(`${s.detail}`);
    console.log(`Preference file: ${prefPath}`);
    return EXIT_OK;
  }
  if (action === "disable") {
    await setTelemetrySendingEnabled(false);
    console.log(`${program}: telemetry disabled (saved to ${prefPath})`);
    return EXIT_OK;
  }
  await setTelemetrySendingEnabled(true);
  console.log(`${program}: telemetry enabled (saved to ${prefPath})`);
  return EXIT_OK;
}

function shouldShowTelemetryFirstRunNotice(parsed: ParsedCli): boolean {
  return (
    parsed.kind === "validate" ||
    parsed.kind === "run" ||
    parsed.kind === "report" ||
    parsed.kind === "doctor" ||
    parsed.kind === "telemetry"
  );
}

/**
 * Run the CLI and return a process exit code (does not call `process.exit`).
 */
export async function runCli(argv: string[]): Promise<number> {
  const program = programLabel();
  const parsed = parseArgs(argv);

  if (parsed.kind === "help") {
    if (parsed.topic !== undefined) {
      const ok = printCommandHelp(program, parsed.topic);
      return ok ? EXIT_OK : EXIT_USAGE;
    }
    printGlobalHelp(program);
    return EXIT_OK;
  }

  if (parsed.kind === "version") {
    console.log(cliPackageVersion());
    return EXIT_OK;
  }

  if (parsed.kind === "error") {
    console.error(`${program}: ${parsed.message}`);
    console.error(`Run '${program} --help' for usage.`);
    return EXIT_USAGE;
  }

  if (shouldShowTelemetryFirstRunNotice(parsed)) {
    await maybeShowFirstRunTelemetryNotice(program);
  }

  if (parsed.kind === "init") {
    return cmdInit(parsed);
  }

  if (parsed.kind === "telemetry") {
    return cmdTelemetry(parsed.action, program);
  }

  let result: CliResult;
  if (parsed.kind === "validate") {
    result = await cmdValidate(parsed);
  } else if (parsed.kind === "run") {
    const { suites, ...rest } = parsed;
    result = await cmdRun({ suites, ...rest });
  } else if (parsed.kind === "report") {
    result = await cmdReport(parsed);
  } else if (parsed.kind === "doctor") {
    result = await cmdDoctorWithTelemetry({ config: parsed.config });
  } else {
    return EXIT_USAGE;
  }

  if (result.telemetry !== undefined && (await isTelemetrySendingEnabled())) {
    await sendTelemetrySnapshot(result.telemetry);
  }
  return result.code;
}
