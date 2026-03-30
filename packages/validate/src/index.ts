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
  openrouterProvider,
  portkeyProvider,
} from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import { readStore } from "./store.js";

type OutputFormat = "text" | "json";
type FailOn = "invalid" | "warn" | "none";
type CheckStatus = "ok" | "warn" | "fail";
type RetryConfig = {
  retries: number;
  baseDelayMs: number;
  timeoutMs: number;
};

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
  summary: {
    hasInvalid: boolean;
    hasTransient: boolean;
    hasWarnings: boolean;
  };
  checks: ValidateCheck[];
};

const PROVIDERS: Record<string, ProviderDefinition> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
  openrouter: openrouterProvider,
  portkey: portkeyProvider,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  const factor = 0.2; // +/- 20%
  const delta = ms * factor;
  return Math.max(0, Math.round(ms + (Math.random() * 2 - 1) * delta));
}

function isTransientHttpStatus(code: number): boolean {
  return code === 408 || code === 429 || (code >= 500 && code <= 599);
}

function createRetryingFetch(cfg: RetryConfig): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let attempt = 0;
    let lastErr: unknown;

    while (attempt <= cfg.retries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
      try {
        const res = await fetch(input, { ...init, signal: controller.signal });
        if (!res.ok && isTransientHttpStatus(res.status) && attempt < cfg.retries) {
          // Best-effort: drain body so Node can reuse connection.
          try {
            await res.arrayBuffer();
          } catch {
            // ignore
          }
          const delay = jitter(cfg.baseDelayMs * Math.pow(2, attempt));
          await sleep(delay);
          attempt += 1;
          continue;
        }
        return res;
      } catch (e) {
        lastErr = e;
        if (attempt >= cfg.retries) break;
        const delay = jitter(cfg.baseDelayMs * Math.pow(2, attempt));
        await sleep(delay);
        attempt += 1;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error("Request failed");
  }) as typeof fetch;
}

function exitCodeFor(report: ValidateReport, failOn: FailOn): number {
  if (failOn === "none") return 0;
  if (failOn === "warn") {
    return report.summary.hasInvalid || report.summary.hasWarnings || report.summary.hasTransient ? 1 : 0;
  }
  // invalid (CI default)
  if (report.summary.hasInvalid) return 1;
  if (report.summary.hasTransient) return 3;
  return 0;
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

async function runValidate(cfg: RetryConfig): Promise<ValidateReport> {
  const cwd = process.cwd();
  const store = await readStore();
  const checks: ValidateCheck[] = [];

  if (store.keys.length === 0) {
    checks.push({
      id: "keys",
      label: "Provider credentials (local)",
      status: "warn",
      message: "no keys to validate",
    });
    return {
      ok: true,
      cwd,
      summary: { hasInvalid: false, hasTransient: false, hasWarnings: true },
      checks,
    };
  }

  let hasInvalid = false;
  let hasTransient = false;
  let hasWarnings = false;

  function parseStatusCode(err: unknown): number | null {
    if (typeof err !== "string") return null;
    const m = err.match(/^(\d{3}):/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }

  const fetchFn = createRetryingFetch(cfg);

  for (const k of store.keys) {
    const provider = PROVIDERS[k.provider];
    if (!provider) {
      hasWarnings = true;
      checks.push({
        id: `key:${k.id}`,
        label: `Credential (${k.provider})`,
        status: "warn",
        message: "unknown provider (skipped)",
        details: { provider: k.provider, id: k.id, mask: k.mask, label: k.label },
      });
      continue;
    }

    const result = await provider.validateKey(k.apiKey, fetchFn);
    if (result.valid) {
      checks.push({
        id: `key:${k.id}`,
        label: `Credential (${k.provider})`,
        status: "ok",
        message: k.mask ?? k.id,
      });
    } else {
      const primaryError = (result.errors?.[0] ?? "Invalid").toString();
      const statusCode = parseStatusCode(primaryError);
      const transient = statusCode != null ? isTransientHttpStatus(statusCode) : true;
      if (transient) hasTransient = true;
      else hasInvalid = true;
      checks.push({
        id: `key:${k.id}`,
        label: `Credential (${k.provider})`,
        status: transient ? "warn" : "fail",
        message: primaryError,
        details: { provider: k.provider, id: k.id, mask: k.mask, label: k.label },
      });
    }
  }

  return {
    ok: !hasInvalid,
    cwd,
    summary: { hasInvalid, hasTransient, hasWarnings },
    checks,
  };
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
    .option("--retries <n>", "Retry count for transient failures (default: 2)", "2")
    .option("--timeout-ms <n>", "Per-request timeout in ms (default: 8000)", "8000")
    .option("--strict", "Preset for CI: --fail-on invalid", false);

  program.parse();
  const opts = program.opts<{
    format?: string;
    out?: string;
    failOn?: string;
    strict?: boolean;
    retries?: string;
    timeoutMs?: string;
  }>();

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

  const retries = Number(opts.retries ?? "2");
  const timeoutMs = Number(opts.timeoutMs ?? "8000");
  if (!Number.isFinite(retries) || retries < 0 || retries > 10) {
    console.error(chalk.red("Invalid --retries. Use an integer between 0 and 10."));
    process.exit(2);
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    console.error(chalk.red("Invalid --timeout-ms. Use a number between 1000 and 120000."));
    process.exit(2);
  }

  try {
    const report = await runValidate({ retries, baseDelayMs: 250, timeoutMs });
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

