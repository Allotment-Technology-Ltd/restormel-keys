/**
 * CI entrypoint driven by environment variables (set from `action.yml`), mirroring
 * packages/testing-github-action/src/run-ci.ts. Runs `keys connect eval` (markdown
 * output), appends the step summary, upserts ONE sticky PR comment (best-effort), writes
 * step outputs, and returns the effective exit code (warn mode downgrades 1/3 to 0).
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildEvalArgs,
  effectiveExitCode,
  EXIT_CONFIG_ERROR,
  parseBoolean,
  verdictForExitCode,
} from "./gate.js";
import { buildStickyCommentBody, stickyMarker, upsertStickyComment } from "./sticky-comment.js";

function getenv(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v.trim() === "" ? undefined : v.trim();
}

function appendSummary(text: string): void {
  const p = process.env.GITHUB_STEP_SUMMARY;
  if (p) appendFileSync(p, `${text}\n`, "utf8");
}

function appendOutput(pairs: Record<string, string>): void {
  const p = process.env.GITHUB_OUTPUT;
  if (!p) return;
  for (const [k, v] of Object.entries(pairs)) appendFileSync(p, `${k}=${v}\n`, "utf8");
}

/** PR number: explicit input first, else the workflow event payload (pull_request.number / issue.number). */
export function resolvePrNumber(explicit: string | undefined, eventJson: unknown): number | null {
  const fromInput = Number(explicit);
  if (explicit && Number.isInteger(fromInput) && fromInput > 0) return fromInput;
  if (eventJson && typeof eventJson === "object") {
    const ev = eventJson as Record<string, unknown>;
    const pr = ev.pull_request as Record<string, unknown> | undefined;
    if (pr && typeof pr.number === "number" && pr.number > 0) return pr.number;
    const issue = ev.issue as Record<string, unknown> | undefined;
    if (issue && typeof issue.number === "number" && issue.number > 0) return issue.number;
  }
  return null;
}

function readEventJson(): unknown {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p || !existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export async function runGateFromEnv(): Promise<number> {
  const workspaceDir = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const wd = getenv("RESTORMEL_CONNECT_EVAL_WORKING_DIRECTORY") ?? ".";
  process.chdir(join(workspaceDir, wd));

  const warnOnly = parseBoolean(getenv("RESTORMEL_CONNECT_EVAL_WARN_ONLY"));
  const countsPath = getenv("RESTORMEL_CONNECT_EVAL_COUNTS_PATH");
  const baselinePath = getenv("RESTORMEL_CONNECT_EVAL_BASELINE_PATH");

  // The CLI entry: explicit input wins; default is the monorepo sibling built dist
  // (packages/cli) relative to the action; final fallback documents the fix.
  const cliJs =
    getenv("RESTORMEL_CONNECT_EVAL_CLI_JS") ?? getenv("RESTORMEL_CONNECT_EVAL_DEFAULT_CLI_JS");
  if (!cliJs || !existsSync(cliJs)) {
    console.error(
      `keys CLI entry not found${cliJs ? ` at ${cliJs}` : ""}. ` +
        "Build it first (pnpm --filter @restormel/keys-cli run build) or pass the `cli_js` input.",
    );
    appendSummary("## Restormel Connect eval\n**Error:** keys CLI entry not found (build @restormel/keys-cli or set `cli_js`).");
    appendOutput({ verdict: "config_error", exit_code: String(EXIT_CONFIG_ERROR), regression: "false", commented: "false" });
    return EXIT_CONFIG_ERROR;
  }

  const args = buildEvalArgs({
    countsPath,
    baselinePath,
    workspace: getenv("RESTORMEL_CONNECT_EVAL_WORKSPACE"),
    project: getenv("RESTORMEL_CONNECT_EVAL_PROJECT"),
    jobId: getenv("RESTORMEL_CONNECT_EVAL_JOB"),
    siteBase: getenv("RESTORMEL_CONNECT_EVAL_SITE_BASE"),
    tolerance: getenv("RESTORMEL_CONNECT_EVAL_TOLERANCE"),
  });

  // RESTORMEL_GATEWAY_KEY is inherited from the step env (action.yml maps the
  // `gateway_key` input straight onto it) — never logged, never an argv value.
  const result = spawnSync(process.execPath, [cliJs, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    console.error(`Failed to run keys CLI: ${result.error.message}`);
    appendOutput({ verdict: "error", exit_code: "1", regression: "false", commented: "false" });
    return 1;
  }

  const cliCode = result.status;
  const verdict = verdictForExitCode(cliCode);
  const markdown = (result.stdout ?? "").trim();
  if (result.stderr) console.error(result.stderr.trim());

  appendSummary("## Restormel Connect eval");
  appendSummary("");
  appendSummary(markdown || "_(no output from `keys connect eval`)_");
  if (warnOnly && (verdict === "quality_fail" || verdict === "regression")) {
    appendSummary("");
    appendSummary("> Warn mode: non-blocking — exit code downgraded to 0 for this check.");
  }

  // Sticky comment (best-effort): requires a token and a PR context.
  let commented = "false";
  const token = getenv("RESTORMEL_CONNECT_EVAL_GITHUB_TOKEN");
  const stickyEnabled = getenv("RESTORMEL_CONNECT_EVAL_STICKY_COMMENT") === undefined
    ? true
    : parseBoolean(getenv("RESTORMEL_CONNECT_EVAL_STICKY_COMMENT"));
  const repository = process.env.GITHUB_REPOSITORY;
  const prNumber = resolvePrNumber(getenv("RESTORMEL_CONNECT_EVAL_PR_NUMBER"), readEventJson());
  if (stickyEnabled && token && repository && prNumber !== null && markdown) {
    const marker = stickyMarker(getenv("RESTORMEL_CONNECT_EVAL_COMMENT_DISCRIMINATOR"));
    const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
    const runId = process.env.GITHUB_RUN_ID;
    try {
      const action = await upsertStickyComment({
        apiBase: process.env.GITHUB_API_URL ?? "https://api.github.com",
        repository,
        prNumber,
        token,
        marker,
        body: buildStickyCommentBody({
          marker,
          verdict,
          markdown,
          warnOnly,
          commitSha: process.env.GITHUB_SHA,
          runUrl: runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : undefined,
        }),
      });
      commented = "true";
      console.log(`Sticky comment ${action} on PR #${prNumber}.`);
    } catch (e) {
      // Best-effort by design: a comment failure must not change the gate verdict.
      console.warn(`Sticky comment skipped: ${e instanceof Error ? e.message : e}`);
    }
  } else if (stickyEnabled && (!token || prNumber === null)) {
    console.log("Sticky comment skipped (no github_token or not a PR context).");
  }

  appendOutput({
    verdict,
    exit_code: String(cliCode ?? 1),
    regression: verdict === "regression" ? "true" : "false",
    commented,
  });

  const code = effectiveExitCode(cliCode, warnOnly);
  if (code !== (cliCode ?? 1)) {
    console.log(`Warn mode: downgrading exit ${cliCode} -> ${code} (verdict stays "${verdict}").`);
  }
  return code;
}
