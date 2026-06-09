/**
 * `keys connect eval` — headless G2 quality verdict (Stage 2.1, Context Regression CI).
 *
 * Evaluates Connect ingest quality against the published bar (≥90% supported,
 * ≤2% unsupported — CONNECT-INGEST-QUALITY-BAR) and emits a versioned JSON verdict
 * (@restormel/contracts/connect-eval) with stable exit codes:
 *   0 — pass · 1 — quality fail · 2 — config/usage error (packages/validate precedent).
 *
 * Remote mode (default) reads a run's public quality report from the gateway-key-authed
 * GET /connect/v1/ingest/jobs endpoints. Local mode (--counts/--stdin) evaluates a counts
 * document produced by any pipeline — no network, CI-friendly.
 */
import type { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ConnectIngestJobListResponseSchema,
  ConnectIngestJobStatusResponseSchema,
  type ConnectIngestJob,
} from "@restormel/contracts/connect";
import type { ConnectEvalVerdict } from "@restormel/contracts/connect-eval";
import {
  buildEvalVerdict,
  EVAL_EXIT_CONFIG_ERROR,
  exitCodeForVerdict,
  parseCountsInput,
  pickLatestAssessedJob,
  verdictFromQualityReport,
} from "../connect-eval.js";
import { renderEval } from "../connect-eval-format.js";

interface ConnectEvalOptions {
  job?: string;
  counts?: string;
  stdin?: boolean;
  output?: string;
  workspace?: string;
  project?: string;
  siteBase?: string;
}

/** Config/usage error: message on stderr, exit code 2. Never used for a quality verdict. */
function failConfig(message: string, detail?: unknown): void {
  console.error(chalk.red(message), detail !== undefined ? detail : "");
  process.exitCode = EVAL_EXIT_CONFIG_ERROR;
}

function resolveSiteBase(opt?: string): string {
  const env = process.env.RESTORMEL_KEYS_BASE?.trim() || process.env.RESTORMEL_CONNECT_API_BASE?.trim();
  return (opt?.trim() || env || "https://restormel.dev").replace(/\/$/, "");
}

async function fetchJson(
  url: string,
  key: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

function parseJsonDocument(raw: string, label: string): unknown | undefined {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    failConfig(`${label} is not valid JSON.`);
    return undefined;
  }
}

/** Local mode: verdict from a counts document (file or stdin). Returns null after failConfig. */
async function evaluateLocal(opts: ConnectEvalOptions): Promise<ConnectEvalVerdict | null> {
  let raw: string;
  let source: { kind: "counts_file" | "stdin"; path?: string };
  if (opts.counts) {
    const abs = resolve(process.cwd(), opts.counts);
    if (!existsSync(abs)) {
      failConfig(`Counts file not found: ${abs}`);
      return null;
    }
    try {
      raw = await readFile(abs, "utf-8");
    } catch (e) {
      failConfig("Could not read counts file:", e instanceof Error ? e.message : e);
      return null;
    }
    source = { kind: "counts_file", path: opts.counts };
  } else {
    raw = await readStdin();
    source = { kind: "stdin" };
  }

  const json = parseJsonDocument(raw, opts.counts ? `Counts file ${opts.counts}` : "Stdin input");
  if (json === undefined) return null;

  const parsed = parseCountsInput(json);
  if (!parsed.ok) {
    failConfig(parsed.error);
    return null;
  }
  const { counts, trust_score, coverage_gaps, fingerprint, assessed_at } = parsed.input;
  return buildEvalVerdict({
    counts,
    source: { ...source, ...(assessed_at ? { assessed_at } : {}) },
    evaluatedAt: new Date().toISOString(),
    trust_score,
    coverage_gaps,
    fingerprint,
  });
}

/** Remote mode: verdict from a run's quality report on the Connect v1 ingest-jobs API. */
async function evaluateRemote(opts: ConnectEvalOptions): Promise<ConnectEvalVerdict | null> {
  const base = resolveSiteBase(opts.siteBase);
  const key = process.env.RESTORMEL_GATEWAY_KEY?.trim();
  const workspace = opts.workspace?.trim() || process.env.RESTORMEL_WORKSPACE_ID?.trim();
  const project = opts.project?.trim() || process.env.RESTORMEL_PROJECT_ID?.trim() || undefined;
  if (!key) {
    failConfig("RESTORMEL_GATEWAY_KEY is required (run `keys login`), or use --counts/--stdin for local mode.");
    return null;
  }
  if (!workspace) {
    failConfig("A workspace is required. Set RESTORMEL_WORKSPACE_ID or pass --workspace.");
    return null;
  }

  const params = new URLSearchParams({ workspace_id: workspace });
  if (project) params.set("project_id", project);

  let job: ConnectIngestJob | null = null;
  if (opts.job) {
    const url = `${base}/connect/v1/ingest/jobs/${encodeURIComponent(opts.job.trim())}?${params}`;
    const res = await fetchJson(url, key).catch((e) => ({
      ok: false,
      status: 0,
      body: { message: e instanceof Error ? e.message : String(e) },
    }));
    if (!res.ok) {
      const body = res.body as Record<string, unknown>;
      failConfig(`Could not fetch ingest job ${opts.job} (${res.status}):`, body.message ?? body.error);
      return null;
    }
    const parsed = ConnectIngestJobStatusResponseSchema.safeParse(res.body);
    if (!parsed.success) {
      failConfig("API returned a job that failed contract validation:", parsed.error.issues.map((i) => i.message).join("; "));
      return null;
    }
    job = parsed.data.job;
    if (!job.quality_report) {
      failConfig(
        `Ingest job ${job.id} has no quality report yet (status: ${job.status}). ` +
          "Quality reports appear once a run reaches a terminal state with graph stats.",
      );
      return null;
    }
  } else {
    params.set("limit", "50");
    const url = `${base}/connect/v1/ingest/jobs?${params}`;
    const res = await fetchJson(url, key).catch((e) => ({
      ok: false,
      status: 0,
      body: { message: e instanceof Error ? e.message : String(e) },
    }));
    if (!res.ok) {
      const body = res.body as Record<string, unknown>;
      failConfig(`Could not list ingest jobs (${res.status}):`, body.message ?? body.error);
      return null;
    }
    const parsed = ConnectIngestJobListResponseSchema.safeParse(res.body);
    if (!parsed.success) {
      failConfig("API returned a job list that failed contract validation:", parsed.error.issues.map((i) => i.message).join("; "));
      return null;
    }
    job = pickLatestAssessedJob(parsed.data.jobs);
    if (!job) {
      failConfig(
        "No ingest run with a quality report found in this workspace (latest 50 jobs). " +
          "Run a Connect ingest to completion first, or pass --job <id>.",
      );
      return null;
    }
  }

  return verdictFromQualityReport({
    report: job.quality_report!,
    source: { kind: "ingest_job", workspace_id: workspace, ...(project ? { project_id: project } : {}), job_id: job.id },
    evaluatedAt: new Date().toISOString(),
  });
}

export function registerConnect(program: Command): void {
  const connect = program.command("connect").description("Connect graph quality commands");

  connect
    .command("eval")
    .description("Evaluate Connect ingest quality against the published G2 bar (exit 0 pass / 1 fail / 2 config error)")
    .option("--job <id>", "evaluate a specific ingest job (default: the latest run with a quality report)")
    .option("--counts <file>", "local mode: evaluate a JSON counts file {ok,weak,unsupported} or a saved quality report")
    .option("--stdin", "local mode: read the counts JSON from stdin")
    .option("--output <format>", "json | pretty", "pretty")
    .option("--workspace <id>", "Keys workspace id (default RESTORMEL_WORKSPACE_ID)")
    .option("--project <id>", "Keys project id (default RESTORMEL_PROJECT_ID)")
    .option("--site-base <url>", "Restormel site origin (default RESTORMEL_KEYS_BASE or https://restormel.dev)")
    .action(async (opts: ConnectEvalOptions) => {
      const format = (opts.output ?? "pretty").toLowerCase();
      if (!["pretty", "json"].includes(format)) {
        failConfig(`Unknown --output ${opts.output}. Use pretty or json.`);
        return;
      }
      if (opts.counts && opts.stdin) {
        failConfig("--counts and --stdin are mutually exclusive.");
        return;
      }
      if (opts.job && (opts.counts || opts.stdin)) {
        failConfig("--job evaluates a remote run and cannot be combined with --counts/--stdin.");
        return;
      }

      const verdict =
        opts.counts || opts.stdin ? await evaluateLocal(opts) : await evaluateRemote(opts);
      if (!verdict) return; // failConfig already set exit code 2

      console.log(renderEval(verdict, format as "pretty" | "json"));
      process.exitCode = exitCodeForVerdict(verdict);
    });
}
