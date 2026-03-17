#!/usr/bin/env node
/**
 * @restormel/doctor — standalone OSS healthcheck entrypoint.
 */
import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "fs";
import { join } from "path";
import { detectFramework } from "./detect.js";
import { readConfig, CONFIG_FILENAME } from "./config.js";
import { readStore } from "./store.js";

type OutputFormat = "text" | "json";

type CheckStatus = "ok" | "warn" | "fail";

type DoctorCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  message?: string;
  details?: unknown;
};

type DoctorReport = {
  ok: boolean;
  cwd: string;
  checks: DoctorCheck[];
};

function toExitCode(report: DoctorReport): number {
  return report.ok ? 0 : 1;
}

function writeOutput(report: DoctorReport, format: OutputFormat): void {
  if (format === "json") {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }

  console.log(chalk.cyan("Restormel Doctor"));
  console.log("");

  for (const c of report.checks) {
    const icon =
      c.status === "ok" ? chalk.green("✓") : c.status === "warn" ? chalk.yellow("○") : chalk.red("✗");
    const label = chalk.white(c.label);
    const msg = c.message ? chalk.gray(`— ${c.message}`) : "";
    console.log(`${icon} ${label} ${msg}`.trimEnd());
  }

  console.log("");
  console.log(report.ok ? chalk.green("OK") : chalk.red("Issues found"));
}

async function runDoctor(): Promise<DoctorReport> {
  const cwd = process.cwd();

  const checks: DoctorCheck[] = [];

  const detected = await detectFramework(cwd);
  checks.push({
    id: "framework",
    label: "Framework detection",
    status: detected.id === "none" ? "warn" : "ok",
    message: detected.name,
    details: { id: detected.id, hasAppRouter: detected.hasAppRouter ?? false },
  });

  const config = await readConfig(cwd);
  checks.push({
    id: "config",
    label: CONFIG_FILENAME,
    status: config ? "ok" : "fail",
    message: config ? "found" : "not found (run keys init)",
    details: config ?? undefined,
  });

  const missingPkgs: string[] = [];
  for (const p of detected.packagePaths) {
    const pkgPath = join(cwd, "node_modules", p);
    const found = existsSync(pkgPath);
    if (!found) missingPkgs.push(p);
  }
  checks.push({
    id: "packages",
    label: "Suggested Restormel packages",
    status: missingPkgs.length === 0 ? "ok" : "fail",
    message: missingPkgs.length === 0 ? "installed" : `missing: ${missingPkgs.join(", ")}`,
    details: { suggested: detected.packagePaths, missing: missingPkgs },
  });

  const store = await readStore(cwd);
  checks.push({
    id: "keys",
    label: "Local key store",
    status: store.keys.length === 0 ? "warn" : "ok",
    message: store.keys.length === 0 ? "no keys stored" : `${store.keys.length} key(s) stored`,
    details: {
      keys: store.keys.map((k) => ({ id: k.id, provider: k.provider, mask: k.mask, label: k.label })),
    },
  });

  const ok = checks.every((c) => c.status !== "fail");
  return { ok, cwd, checks };
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("restormel-doctor")
    .description("Restormel Doctor — open-source CLI for setup and health checks")
    .version("0.1.0")
    .option("--format <format>", "Output format: text|json", "text")
    .option("--out <path>", "Write JSON output to a file (requires --format json)");

  program.parse();
  const opts = program.opts<{ format?: string; out?: string }>();

  const format = (opts.format ?? "text") as OutputFormat;
  if (format !== "text" && format !== "json") {
    console.error(chalk.red("Invalid --format. Use text or json."));
    process.exit(2);
  }
  if (opts.out && format !== "json") {
    console.error(chalk.red("--out requires --format json."));
    process.exit(2);
  }

  try {
    const report = await runDoctor();
    if (opts.out) {
      const { writeFile } = await import("fs/promises");
      await writeFile(opts.out, JSON.stringify(report, null, 2) + "\n", "utf-8");
    }
    writeOutput(report, format);
    process.exit(toExitCode(report));
  } catch (e) {
    console.error(chalk.red("Doctor failed:"), e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}

void main();

