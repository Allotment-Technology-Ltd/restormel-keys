/**
 * Renderers for `keys connect eval`: pretty (terminal), markdown, and json.
 * Pure string builders — no I/O — so they are unit-testable.
 * Markdown follows the replay-format.ts conventions (PR-comment friendly).
 */
import chalk from "chalk";
import type { ConnectEvalDiff, ConnectEvalVerdict } from "@restormel/contracts/connect-eval";

const RULE = "─".repeat(51);

export type EvalOutputFormat = "pretty" | "json" | "markdown";

function truncate(text: string, max = 96): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : oneLine.slice(0, max - 1) + "…";
}

/** Markdown-table cell safety: collapse whitespace and escape pipes. */
function mdCell(text: string, max = 96): string {
  return truncate(text, max).replace(/\|/g, "\\|");
}

function fmtDelta(n: number, suffix = ""): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}${suffix}`;
}

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

// ── Markdown (verdict only) ─────────────────────────────────────────────────

export function renderEvalMarkdown(verdict: ConnectEvalVerdict): string {
  const { g2, targets } = verdict;
  const out: string[] = [];
  out.push("# Restormel connect eval");
  out.push("");
  out.push(`- **Source:** ${describeSource(verdict)}`);
  out.push(`- **Evaluated:** ${verdict.evaluated_at}`);
  out.push(
    `- **G2:** ${g2.ok} ok · ${g2.weak} weak · ${g2.unsupported} unsupported → ${g2.ok_pct}% ok · ${g2.unsupported_pct}% unsupported`,
  );
  out.push(`- **Bar:** ok ≥ ${targets.ok_pct_min}% · unsupported ≤ ${targets.unsupported_pct_max}%`);
  if (verdict.trust_score !== undefined) out.push(`- **Trust score:** ${Math.round(verdict.trust_score)}/100`);
  if (verdict.coverage_gaps !== undefined) out.push(`- **Coverage gaps:** ${verdict.coverage_gaps}`);
  if (verdict.fingerprint !== undefined) out.push(`- **Fingerprint:** \`${verdict.fingerprint}\``);
  out.push("");
  if (verdict.pass) {
    out.push("**Verdict: PASS** — quality bar met");
  } else {
    out.push("**Verdict: FAIL**");
    for (const reason of verdict.reasons) out.push(`- ✗ ${reason}`);
  }
  return out.join("\n");
}

export function renderEval(verdict: ConnectEvalVerdict, format: EvalOutputFormat): string {
  if (format === "json") return renderEvalJson(verdict);
  if (format === "markdown") return renderEvalMarkdown(verdict);
  return renderEvalPretty(verdict);
}

// ── Baseline diff (Stage 2.2) ───────────────────────────────────────────────

function diffRowStatus(regressed: boolean, available: boolean): string {
  if (!available) return "—";
  return regressed ? "❌ regression" : "✓ ok";
}

interface DiffRow {
  metric: string;
  baseline: string;
  current: string;
  delta: string;
  status: string;
}

function diffRows(diff: ConnectEvalDiff, baseline: ConnectEvalVerdict, current: ConnectEvalVerdict): DiffRow[] {
  const okRegressed = diff.deltas.ok_pct < -diff.tolerance;
  const trustRegressed = diff.deltas.trust_score !== undefined && diff.deltas.trust_score < -diff.tolerance;
  const gapsRegressed = diff.deltas.coverage_gaps !== undefined && diff.deltas.coverage_gaps > 0;
  const rows: DiffRow[] = [
    {
      metric: "ok %",
      baseline: `${baseline.g2.ok_pct}%`,
      current: `${current.g2.ok_pct}%`,
      delta: fmtDelta(diff.deltas.ok_pct),
      status: diffRowStatus(okRegressed && !diff.fingerprint_changed, !diff.fingerprint_changed),
    },
    {
      metric: "unsupported %",
      baseline: `${baseline.g2.unsupported_pct}%`,
      current: `${current.g2.unsupported_pct}%`,
      delta: fmtDelta(diff.deltas.unsupported_pct),
      status: "—", // informational: judged by the absolute bar, not the baseline diff
    },
    {
      metric: "trust score",
      baseline: baseline.trust_score !== undefined ? String(Math.round(baseline.trust_score)) : "—",
      current: current.trust_score !== undefined ? String(Math.round(current.trust_score)) : "—",
      delta: diff.deltas.trust_score !== undefined ? fmtDelta(diff.deltas.trust_score) : "—",
      status: diffRowStatus(trustRegressed, diff.deltas.trust_score !== undefined && !diff.fingerprint_changed),
    },
    {
      metric: "coverage gaps",
      baseline: baseline.coverage_gaps !== undefined ? String(baseline.coverage_gaps) : "—",
      current: current.coverage_gaps !== undefined ? String(current.coverage_gaps) : "—",
      delta: diff.deltas.coverage_gaps !== undefined ? fmtDelta(diff.deltas.coverage_gaps) : "—",
      status: diffRowStatus(gapsRegressed, diff.deltas.coverage_gaps !== undefined && !diff.fingerprint_changed),
    },
    {
      metric: "new unsupported claims",
      baseline: "—",
      current: diff.claims_compared ? String(diff.new_unsupported_claims.length) : "not compared",
      delta: "—",
      status: diffRowStatus(diff.new_unsupported_claims.length > 0, diff.claims_compared),
    },
  ];
  return rows;
}

/** The PR-comment markdown: header, regression table, and the per-claim citation table. */
export function renderEvalDiffMarkdown(
  current: ConnectEvalVerdict,
  diff: ConnectEvalDiff,
  baseline: ConnectEvalVerdict,
): string {
  const out: string[] = [];
  out.push("# Restormel connect eval — baseline diff");
  out.push("");
  out.push(
    `- **Baseline:** saved ${diff.baseline_saved_at}${diff.baseline_fingerprint ? ` · fingerprint \`${diff.baseline_fingerprint}\`` : ""}`,
  );
  out.push(
    `- **Current:** evaluated ${current.evaluated_at}${diff.current_fingerprint ? ` · fingerprint \`${diff.current_fingerprint}\`` : ""}`,
  );
  out.push(
    `- **Quality bar:** ${current.pass ? "PASS" : `FAIL (${current.reasons.join("; ")})`} · **Tolerance:** ${diff.tolerance}pt`,
  );
  out.push("");

  if (diff.fingerprint_changed) {
    out.push(
      `> ⚠ **Source-set fingerprint changed** (\`${diff.baseline_fingerprint}\` → \`${diff.current_fingerprint}\`): ` +
        "the corpus changed, so this baseline is superseded — regression checks skipped. " +
        "Re-save with `--save-baseline` to key a new baseline.",
    );
    out.push("");
  }

  out.push("| Metric | Baseline | Current | Δ | Status |");
  out.push("|---|---:|---:|---:|:--|");
  for (const r of diffRows(diff, baseline, current)) {
    out.push(`| ${r.metric} | ${r.baseline} | ${r.current} | ${r.delta} | ${r.status} |`);
  }
  out.push("");

  if (diff.new_unsupported_claims.length > 0) {
    out.push(`## New unsupported claims (${diff.new_unsupported_claims.length})`);
    out.push("");
    out.push("| Claim | Source |");
    out.push("|---|---|");
    for (const c of diff.new_unsupported_claims) {
      out.push(`| ${mdCell(c.text)} | ${c.source_ref ? mdCell(c.source_ref, 120) : "—"} |`);
    }
    out.push("");
  } else if (!diff.claims_compared && !diff.fingerprint_changed) {
    out.push(
      "> Claim-level diff not available: baseline or current verdict carries no `unsupported_claims` list.",
    );
    out.push("");
  }

  if (diff.fingerprint_changed) {
    out.push("**Summary:** BASELINE SUPERSEDED — corpus changed, not a regression");
  } else if (diff.regression) {
    out.push(`**Summary:** REGRESSION — ${diff.regressions.length} finding(s)`);
  } else {
    out.push("**Summary:** NO REGRESSION — within tolerance of baseline");
  }
  return out.join("\n");
}

export function renderEvalDiffPretty(
  current: ConnectEvalVerdict,
  diff: ConnectEvalDiff,
  baseline: ConnectEvalVerdict,
): string {
  const lines: string[] = [renderEvalPretty(current)];
  lines.push(chalk.bold("BASELINE DIFF"));
  lines.push(
    `Baseline:  saved ${diff.baseline_saved_at}${diff.baseline_fingerprint ? chalk.dim(` · fingerprint ${diff.baseline_fingerprint}`) : ""}`,
  );
  lines.push(chalk.dim(`Tolerance: ${diff.tolerance}pt drop allowed (ok_pct, trust_score)`));

  if (diff.fingerprint_changed) {
    lines.push("");
    lines.push(
      chalk.yellow.bold(
        `⚠ Source-set fingerprint changed (${diff.baseline_fingerprint} → ${diff.current_fingerprint}).`,
      ),
    );
    lines.push(chalk.yellow("  Corpus changed — baseline superseded, regression checks skipped."));
    lines.push(chalk.yellow("  Re-save with --save-baseline to key a new baseline."));
    lines.push(chalk.dim(RULE));
    return lines.join("\n");
  }

  for (const r of diffRows(diff, baseline, current)) {
    lines.push(
      `  ${r.metric.padEnd(22)} ${r.baseline.padStart(6)} → ${r.current.padEnd(12)} ${r.delta.padStart(6)}  ${r.status}`,
    );
  }
  lines.push("");
  if (diff.regression) {
    lines.push(chalk.red.bold(`REGRESSION: ${diff.regressions.length} finding(s) vs baseline`));
    for (const reason of diff.regressions) lines.push(chalk.red(`  ✗ ${truncate(reason, 160)}`));
  } else {
    lines.push(chalk.green.bold("NO REGRESSION — within tolerance of baseline"));
  }
  lines.push(chalk.dim(RULE));
  return lines.join("\n");
}

/** JSON with a baseline diff: both documents, each schema-valid on its own. */
export function renderEvalDiffJson(current: ConnectEvalVerdict, diff: ConnectEvalDiff): string {
  return JSON.stringify({ verdict: current, diff }, null, 2);
}

export function renderEvalDiff(
  current: ConnectEvalVerdict,
  diff: ConnectEvalDiff,
  baseline: ConnectEvalVerdict,
  format: EvalOutputFormat,
): string {
  if (format === "json") return renderEvalDiffJson(current, diff);
  if (format === "markdown") return renderEvalDiffMarkdown(current, diff, baseline);
  return renderEvalDiffPretty(current, diff, baseline);
}
