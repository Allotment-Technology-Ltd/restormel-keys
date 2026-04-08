import { access, constants, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { resolvePathUnderRoot } from "@restormel/testing-core";
import { formatConfigErrors, loadConfigFromFile } from "@restormel/testing-config";
import { keysAdapterOptionsFromProcessEnv } from "@restormel/testing-keys-adapter";
import {
  formatRunSummary,
  PRE_RUN_FAILURE_JSON,
  readRunArtifacts,
  writeRunReportBundle,
} from "@restormel/testing-report";
import { runLocalSuite } from "@restormel/testing-runner";
import { runDoctor } from "./doctor.js";
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE } from "./exit-codes.js";
import { printCommandHelp, printGlobalHelp } from "./help.js";
import { parseArgs } from "./parse-args.js";
import { STARTER_CONFIG_YAML } from "./starter-config.js";
import { cliPackageVersion } from "./version.js";

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

async function cmdValidate(opts: { config: string; json: boolean }): Promise<number> {
  const loaded = await loadConfigFromFile(opts.config);
  if (!loaded.ok) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, errors: loaded.errors }, null, 2));
    } else {
      console.error(formatConfigErrors(loaded.errors));
    }
    return EXIT_USAGE;
  }
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
  return EXIT_OK;
}

function defaultArtifactDir(): string {
  const slug = new Date().toISOString().replace(/[:.]/g, "-");
  return join(process.cwd(), ".restormel-testing", "runs", `run-${slug}`);
}

async function cmdRun(opts: {
  suite: string;
  config: string;
  environmentId?: string;
  targetUrl?: string;
  commitSha?: string;
  repository?: string;
  artifactDir?: string;
  headless: boolean;
  trigger: "local" | "ci";
  goalIds?: string[];
  json: boolean;
}): Promise<number> {
  const cwd = process.cwd();
  let artifactDir: string;
  if (opts.artifactDir !== undefined) {
    const ar = resolvePathUnderRoot(cwd, opts.artifactDir);
    if (!ar.ok) {
      console.error(ar.reason);
      return EXIT_USAGE;
    }
    artifactDir = ar.path;
  } else {
    artifactDir = defaultArtifactDir();
  }
  await mkdir(artifactDir, { recursive: true });

  const keysAdapterOptions = keysAdapterOptionsFromProcessEnv();

  const result = await runLocalSuite({
    configPath: opts.config,
    suiteId: opts.suite,
    environmentId: opts.environmentId,
    targetUrlOverride: opts.targetUrl,
    commitSha: opts.commitSha,
    repository: opts.repository,
    trigger: opts.trigger,
    artifactDir,
    headless: opts.headless,
    goalIds: opts.goalIds,
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
            errors: result.errors,
            artifact_dir: artifactDir,
            partial_artifacts: [PRE_RUN_FAILURE_JSON],
          },
          null,
          2,
        ),
      );
    } else {
      console.error(result.errors.join("\n"));
      console.error(`Partial artefacts: ${artifactDir} (${PRE_RUN_FAILURE_JSON})`);
    }
    for (const w of result.warnings) console.warn(w);
    return EXIT_USAGE;
  }

  const run = result.run;
  if (!run) {
    console.error("Internal error: missing run record.");
    return EXIT_FAILED;
  }

  const program = programLabel();
  let reproduceRun = `${program} run --suite ${opts.suite} --config ${opts.config}`;
  if (opts.environmentId !== undefined) reproduceRun += ` --environment ${opts.environmentId}`;
  if (opts.goalIds !== undefined && opts.goalIds.length > 0) {
    reproduceRun += ` --goal ${opts.goalIds.join(",")}`;
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
    console.log(formatRunSummary(run));
    console.log(
      `\nArtefacts: ${artifactDir}\n  (run.json, traces.json, report.json, summary.md, github-summary.md, junit.xml)`,
    );
  }

  if (run.verdict !== "passed") {
    return EXIT_FAILED;
  }
  return EXIT_OK;
}

async function cmdReport(opts: { path: string }): Promise<number> {
  const loaded = await readRunArtifacts(opts.path);
  if (!("run" in loaded)) {
    console.error(loaded.message);
    return EXIT_USAGE;
  }
  console.log(formatRunSummary(loaded.run));
  if (loaded.warnings.length > 0) {
    console.warn("Warnings from run:");
    for (const w of loaded.warnings) console.warn(`  ${w}`);
  }
  return EXIT_OK;
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

  if (parsed.kind === "init") {
    return cmdInit(parsed);
  }

  if (parsed.kind === "validate") {
    return cmdValidate(parsed);
  }

  if (parsed.kind === "run") {
    return cmdRun(parsed);
  }

  if (parsed.kind === "report") {
    return cmdReport(parsed);
  }

  if (parsed.kind === "doctor") {
    return runDoctor({ config: parsed.config });
  }

  return EXIT_USAGE;
}
