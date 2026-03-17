#!/usr/bin/env node
/**
 * @restormel/validate — standalone OSS validation entrypoint.
 */
import { Command } from "commander";
import chalk from "chalk";
import {
  openaiProvider,
  anthropicProvider,
  googleProvider,
} from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import { readStore } from "./store.js";

type OutputFormat = "text" | "json";
type FailOn = "invalid" | "warn" | "none";
type CheckStatus = "ok" | "warn" | "fail";

type ValidateCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  message?: string;
  details?: unknown;
};

type ValidateReport = {
  ok: boolean;
  cwd: string;
  checks: ValidateCheck[];
};

const PROVIDERS: Record<string, ProviderDefinition> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
};

function exitCodeFor(report: ValidateReport, failOn: FailOn): number {
  if (failOn === "none") return 0;
  if (failOn === "warn") {
    const hasFail = report.checks.some((c) => c.status === "fail");
    return hasFail ? 1 : 0;
  }
  // invalid
  return report.ok ? 0 : 1;
}

function writeOutput(report: ValidateReport, format: OutputFormat): void {
  if (format === "json") {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }

  console.log(chalk.cyan("Restormel Validate"));
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

async function runValidate(): Promise<ValidateReport> {
  const cwd = process.cwd();
  const store = await readStore(cwd);
  const checks: ValidateCheck[] = [];

  if (store.keys.length === 0) {
    checks.push({
      id: "keys",
      label: "Stored keys",
      status: "warn",
      message: "no keys to validate",
    });
    return { ok: true, cwd, checks };
  }

  let allValid = true;
  for (const k of store.keys) {
    const provider = PROVIDERS[k.provider];
    if (!provider) {
      checks.push({
        id: `key:${k.id}`,
        label: `Key (${k.provider})`,
        status: "warn",
        message: "unknown provider (skipped)",
        details: { provider: k.provider, id: k.id, mask: k.mask, label: k.label },
      });
      continue;
    }

    const result = await provider.validateKey(k.apiKey);
    if (result.valid) {
      checks.push({
        id: `key:${k.id}`,
        label: `Key (${k.provider})`,
        status: "ok",
        message: k.mask ?? k.id,
      });
    } else {
      allValid = false;
      checks.push({
        id: `key:${k.id}`,
        label: `Key (${k.provider})`,
        status: "fail",
        message: (result.errors?.[0] ?? "Invalid").toString(),
        details: { provider: k.provider, id: k.id, mask: k.mask, label: k.label },
      });
    }
  }

  return { ok: allValid, cwd, checks };
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("restormel-validate")
    .description("Restormel Validate — open-source CLI for credential and configuration validation")
    .version("0.1.0")
    .option("--format <format>", "Output format: text|json", "text")
    .option("--out <path>", "Write JSON output to a file (requires --format json)")
    .option("--fail-on <mode>", "Fail policy: invalid|warn|none", "invalid")
    .option("--strict", "Preset for CI: --fail-on invalid", false);

  program.parse();
  const opts = program.opts<{ format?: string; out?: string; failOn?: string; strict?: boolean }>();

  const format = (opts.format ?? "text") as OutputFormat;
  if (format !== "text" && format !== "json") {
    console.error(chalk.red("Invalid --format. Use text or json."));
    process.exit(2);
  }
  if (opts.out && format !== "json") {
    console.error(chalk.red("--out requires --format json."));
    process.exit(2);
  }

  const failOn = (opts.strict ? "invalid" : (opts.failOn ?? "invalid")) as FailOn;
  if (failOn !== "invalid" && failOn !== "warn" && failOn !== "none") {
    console.error(chalk.red("Invalid --fail-on. Use invalid, warn, or none."));
    process.exit(2);
  }

  try {
    const report = await runValidate();
    if (opts.out) {
      const { writeFile } = await import("fs/promises");
      await writeFile(opts.out, JSON.stringify(report, null, 2) + "\n", "utf-8");
    }
    writeOutput(report, format);
    process.exit(exitCodeFor(report, failOn));
  } catch (e) {
    console.error(chalk.red("Validate failed:"), e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}

void main();

