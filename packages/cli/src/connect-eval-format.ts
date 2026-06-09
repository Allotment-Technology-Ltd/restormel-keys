/**
 * Renderers for `keys connect eval`: pretty (terminal) and json.
 * Pure string builders — no I/O — so they are unit-testable.
 */
import chalk from "chalk";
import type { ConnectEvalVerdict } from "@restormel/contracts/connect-eval";

const RULE = "─".repeat(51);

function describeSource(verdict: ConnectEvalVerdict): string {
  const s = verdict.source;
  if (s.kind === "ingest_job") {
    const scope = [s.workspace_id ? `workspace ${s.workspace_id}` : null, s.project_id ? `project ${s.project_id}` : null]
      .filter(Boolean)
      .join(" · ");
    return `ingest job ${s.job_id ?? "(unknown)"}${scope ? ` (${scope})` : ""}`;
  }
  if (s.kind === "counts_file") return `local counts file ${s.path ?? "(unknown)"}`;
  return "local counts (stdin)";
}

export function renderEvalPretty(verdict: ConnectEvalVerdict): string {
  const { g2, targets } = verdict;
  const lines: string[] = [];
  lines.push(chalk.dim(RULE));
  lines.push(chalk.bold("RESTORMEL CONNECT EVAL"));
  lines.push(`Source:    ${chalk.cyan(describeSource(verdict))}`);
  if (verdict.source.assessed_at) lines.push(`Assessed:  ${verdict.source.assessed_at}`);
  lines.push(`Evaluated: ${verdict.evaluated_at}`);
  lines.push(chalk.dim(RULE));
  lines.push(
    `G2:  ${chalk.green(`${g2.ok} ok`)} · ${chalk.yellow(`${g2.weak} weak`)} · ${chalk.red(`${g2.unsupported} unsupported`)}` +
      `  →  ${g2.ok_pct}% ok · ${g2.unsupported_pct}% unsupported`,
  );
  lines.push(chalk.dim(`Bar: ok ≥ ${targets.ok_pct_min}% · unsupported ≤ ${targets.unsupported_pct_max}%`));
  if (verdict.trust_score !== undefined) lines.push(`Trust score:   ${Math.round(verdict.trust_score)}/100`);
  if (verdict.coverage_gaps !== undefined) lines.push(`Coverage gaps: ${verdict.coverage_gaps}`);
  if (verdict.fingerprint !== undefined) lines.push(chalk.dim(`Fingerprint:   ${verdict.fingerprint}`));
  lines.push("");
  if (verdict.pass) {
    lines.push(chalk.green.bold("VERDICT: PASS — quality bar met"));
  } else {
    lines.push(chalk.red.bold("VERDICT: FAIL"));
    for (const reason of verdict.reasons) lines.push(chalk.red(`  ✗ ${reason}`));
  }
  lines.push(chalk.dim(RULE));
  return lines.join("\n");
}

export function renderEvalJson(verdict: ConnectEvalVerdict): string {
  return JSON.stringify(verdict, null, 2);
}

export function renderEval(verdict: ConnectEvalVerdict, format: "pretty" | "json"): string {
  return format === "json" ? renderEvalJson(verdict) : renderEvalPretty(verdict);
}
