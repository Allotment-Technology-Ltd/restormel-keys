#!/usr/bin/env node
/**
 * @restormel/doctor — standalone OSS healthcheck entrypoint.
 */
import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
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

  const detected = await detectFramework();
  checks.push({
    id: "framework",
    label: "Framework detection",
    status: detected.id === "none" ? "warn" : "ok",
    message: detected.name,
    details: { id: detected.id, hasAppRouter: detected.hasAppRouter ?? false },
  });

  const config = await readConfig();
  checks.push({
    id: "config",
    label: CONFIG_FILENAME,
    status: config ? "ok" : "fail",
    message: config ? "found" : "not found (run keys init)",
    details: config ?? undefined,
  });

  const missingCore = detected.corePackages.filter((p) => {
    return !existsSync(`node_modules/${p}`);
  });
  checks.push({
    id: "packages-core",
    label: "Core package (@restormel/keys)",
    status: missingCore.length === 0 ? "ok" : "fail",
    message:
      missingCore.length === 0
        ? "installed"
        : `missing: ${missingCore.join(", ")} (pnpm add @restormel/keys)`,
    details: { required: detected.corePackages, missing: missingCore },
  });

  const missingUi = detected.optionalUiPackages.filter((p) => {
    return !existsSync(`node_modules/${p}`);
  });
  if (detected.optionalUiPackages.length > 0) {
    checks.push({
      id: "packages-ui",
      label: "UI packages (Phase 5 — optional)",
      status: missingUi.length === 0 ? "ok" : "warn",
      message:
        missingUi.length === 0
          ? "installed"
          : `not installed: ${missingUi.join(", ")} — OK for headless Phases 1–4; add before Phase 5`,
      details: { optional: detected.optionalUiPackages, missing: missingUi },
    });
  }

  const store = await readStore();
  checks.push({
    id: "keys",
    label: "Local key store",
    status: store.keys.length === 0 ? "warn" : "ok",
    message: store.keys.length === 0 ? "no keys stored" : `${store.keys.length} key(s) stored`,
    details: {
      keys: store.keys.map((k) => ({ id: k.id, provider: k.provider, mask: k.mask, label: k.label })),
    },
  });

  // Optional: best-effort repo scan (no secrets; identifiers only).
  const repoOpt = process.env.RESTORMEL_DOCTOR_REPO_SCAN === "1";
  if (repoOpt) {
    checks.push({
      id: "repo",
      label: "Repo scan (best-effort)",
      status: "warn",
      message: "repo scan temporarily disabled in this build",
    });

    // Optional: registry mapping for lifecycle/deprecation risk.
    if (existsSync("registry/models.json")) {
      type RegistryModel = {
        id: string;
        lifecycle: "active" | "deprecated" | "sunset" | "removed";
        deprecatedAt?: string;
        sunsetAt?: string;
        replacedBy?: string;
      };
      type Registry = {
        version: number;
        lastUpdatedAt?: string;
        models: RegistryModel[];
      };

      try {
        const rawRegistry = await readFile("registry/models.json", "utf-8");
        const registry = JSON.parse(rawRegistry) as Registry;
        const models = new Set<string>();
        const byId = new Map<string, RegistryModel>(
          (registry.models ?? []).map((m) => [m.id.toLowerCase(), m])
        );

        const flagged: Array<{ id: string; lifecycle: string; replacedBy?: string; sunsetAt?: string }> = [];
        for (const m of models) {
          const entry = byId.get(m.toLowerCase());
          if (!entry) continue;
          if (entry.lifecycle !== "active") {
            flagged.push({
              id: entry.id,
              lifecycle: entry.lifecycle,
              replacedBy: entry.replacedBy,
              sunsetAt: entry.sunsetAt ?? entry.deprecatedAt,
            });
          }
        }

        const hasBlocking = flagged.some((f) => f.lifecycle === "sunset" || f.lifecycle === "removed");
        checks.push({
          id: "registry",
          label: "Model lifecycle (registry)",
          status: hasBlocking ? "fail" : flagged.length ? "warn" : "ok",
          message: flagged.length
            ? `${flagged.length} model(s) flagged (${hasBlocking ? "blocking" : "advisory"})`
            : "no flagged models",
          details: {
            registryLastUpdatedAt: registry.lastUpdatedAt,
            flagged: flagged.slice(0, 100),
          },
        });
      } catch (e) {
        checks.push({
          id: "registry",
          label: "Model lifecycle (registry)",
          status: "warn",
          message: "failed to read registry/models.json",
          details: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    } else {
      checks.push({
        id: "registry",
        label: "Model lifecycle (registry)",
        status: "warn",
        message: "registry/models.json not found",
      });
    }
  }

  const ok = checks.every((c) => c.status !== "fail");
  return { ok, cwd, checks };
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("restormel-doctor")
    .description("Restormel Doctor — open-source CLI for setup and health checks")
    .version("0.1.4")
    .option("--format <format>", "Output format: text|json", "text")
    .option("--out <path>", "Write JSON output to a file (requires --format json)")
    .option("--repo", "Best-effort scan of the repo for provider/model identifiers (no secrets)", false)
    .option("--manifest-out <path>", "Write a repo scan manifest JSON file (requires --repo)");

  program.parse();
  const opts = program.opts<{ format?: string; out?: string; repo?: boolean; manifestOut?: string }>();

  const format = (opts.format ?? "text") as OutputFormat;
  if (format !== "text" && format !== "json") {
    console.error(chalk.red("Invalid --format. Use text or json."));
    process.exit(2);
  }
  if (opts.out && format !== "json") {
    console.error(chalk.red("--out requires --format json."));
    process.exit(2);
  }
  if (opts.manifestOut && !opts.repo) {
    console.error(chalk.red("--manifest-out requires --repo."));
    process.exit(2);
  }

  try {
    if (opts.repo) process.env.RESTORMEL_DOCTOR_REPO_SCAN = "1";
    if (opts.manifestOut) process.env.RESTORMEL_DOCTOR_MANIFEST_OUT = opts.manifestOut;
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

