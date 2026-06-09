/**
 * Renderers for `keys replay` (Stage 4D): pretty (terminal), markdown, and json.
 * Pure string builders — no I/O — so they are unit-testable.
 */
import chalk from "chalk";
import type { ProvenanceTrace } from "@restormel/contracts/provenance-trace";
import {
  replayScore,
  type ReplayClaim,
  type ReplayClaimDiff,
  type ReplayDiff,
} from "./replay-diff.js";

export interface ReplayRenderContext {
  trace: ProvenanceTrace;
  diff: ReplayDiff;
  replayedAt: string;
  original: ReplayClaim[];
  current: ReplayClaim[];
}

export interface ReplayRenderOptions {
  /** Show the full per-claim STABLE/CHANGED/NEW breakdown (--diff). */
  detailed: boolean;
  /** Also list the original and current claim sets side by side (--compare). */
  compare: boolean;
}

const RULE = "─".repeat(51);

function truncate(text: string, max = 64): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : oneLine.slice(0, max - 1) + "…";
}

/** trust scores are 0–100; seed/confidence scores are 0–1. Render each in its natural scale. */
function fmtScore(n: number | null): string {
  if (n === null) return "—";
  return n <= 1 ? n.toFixed(2) : String(Math.round(n));
}

function snapLabel(snap: ReplayClaimDiff["original" | "current"]): string {
  if (!snap) return "—";
  const score = snap.trust_score ?? snap.confidence_score ?? null;
  return `${snap.verification} ${fmtScore(score)}`.trim();
}

// ── Pretty (terminal) ───────────────────────────────────────────────────────

export function renderPretty(ctx: ReplayRenderContext, opts: ReplayRenderOptions): string {
  const { trace, diff } = ctx;
  const lines: string[] = [];
  lines.push(chalk.dim(RULE));
  lines.push(chalk.bold("RESTORMEL REPLAY"));
  lines.push(`Original query: ${chalk.cyan(`"${trace.query || "(seed expansion)"}"`)}`);
  lines.push(`Traced:   ${trace.queried_at} · ${diff.counts.originalTotal} claims`);
  lines.push(`Replayed: ${ctx.replayedAt} · ${diff.counts.currentTotal} claims`);
  lines.push(chalk.dim(RULE));

  if (diff.significantDrift) {
    lines.push("");
    lines.push(
      chalk.yellow.bold(
        `⚠ Significant drift detected: ${Math.round(diff.driftRatio * 100)}% of original claims changed since this trace was recorded.`,
      ),
    );
    lines.push(chalk.yellow("  The graph may have been re-ingested or substantially modified."));
  }

  if (opts.compare) {
    lines.push("");
    lines.push(chalk.bold(`ORIGINAL (${ctx.original.length} claims at trace time)`));
    for (const c of ctx.original) lines.push(`  · [${fmtScore(replayScore(c))}] ${truncate(c.claim_text)}`);
    lines.push("");
    lines.push(chalk.bold(`CURRENT (${ctx.current.length} claims now)`));
    for (const c of ctx.current) lines.push(`  · [${fmtScore(replayScore(c))}] ${truncate(c.claim_text)}`);
  }

  if (opts.detailed) {
    lines.push("");
    lines.push(chalk.green.bold(`STABLE (${diff.counts.stable} claims — unchanged since trace)`));
    for (const d of diff.stable) {
      lines.push(chalk.green(`✓ [${fmtScore(d.current?.trust_score ?? d.current?.confidence_score ?? null)}] ${truncate(d.text)}`));
    }

    lines.push("");
    lines.push(chalk.yellow.bold(`CHANGED (${diff.counts.changed} claims)`));
    for (const d of diff.changed) {
      lines.push(chalk.yellow(`~ [was ${snapLabel(d.original)}] ${truncate(d.text)}`));
      if (d.status === "removed") {
        lines.push(`  ${chalk.red("Now: REMOVED")} — claim no longer returned under the same policy`);
      } else {
        lines.push(`  Now: ${chalk.bold(snapLabel(d.current))} — verification re-run since the trace`);
      }
    }

    lines.push("");
    lines.push(chalk.blue.bold(`NEW (${diff.counts.new} claims)`));
    for (const d of diff.added) {
      lines.push(chalk.blue(`+ [${snapLabel(d.current)}] ${truncate(d.text)}`));
    }
  }

  lines.push("");
  lines.push(chalk.dim(RULE));
  lines.push(
    `SUMMARY: ${chalk.green(`${diff.counts.stable} stable`)} · ${chalk.yellow(`${diff.counts.changed} changed`)} · ${chalk.blue(`${diff.counts.new} new`)}`,
  );
  lines.push("If this replay differs from expected: check recent ingest runs and");
  lines.push(`graph changes with: ${chalk.cyan("keys inspect --watch")}`);
  lines.push(chalk.dim(RULE));
  return lines.join("\n");
}

// ── Markdown ────────────────────────────────────────────────────────────────

export function renderMarkdown(ctx: ReplayRenderContext, opts: ReplayRenderOptions): string {
  const { trace, diff } = ctx;
  const out: string[] = [];
  out.push("# Restormel replay");
  out.push("");
  out.push(`- **Original query:** ${trace.query || "(seed expansion)"}`);
  out.push(`- **Traced:** ${trace.queried_at} · ${diff.counts.originalTotal} claims`);
  out.push(`- **Replayed:** ${ctx.replayedAt} · ${diff.counts.currentTotal} claims`);
  out.push("");
  if (diff.significantDrift) {
    out.push(
      `> ⚠ **Significant drift:** ${Math.round(diff.driftRatio * 100)}% of original claims changed since this trace was recorded. The graph may have been re-ingested or substantially modified.`,
    );
    out.push("");
  }

  if (opts.detailed) {
    out.push(`## Stable (${diff.counts.stable})`);
    for (const d of diff.stable) out.push(`- ✓ \`${fmtScore(d.current?.trust_score ?? d.current?.confidence_score ?? null)}\` ${truncate(d.text)}`);
    out.push("");
    out.push(`## Changed (${diff.counts.changed})`);
    for (const d of diff.changed) {
      out.push(`- ~ _was ${snapLabel(d.original)}_ — ${truncate(d.text)}`);
      out.push(d.status === "removed" ? `  - **REMOVED** under the same policy` : `  - now **${snapLabel(d.current)}**`);
    }
    out.push("");
    out.push(`## New (${diff.counts.new})`);
    for (const d of diff.added) out.push(`- + **${snapLabel(d.current)}** ${truncate(d.text)}`);
    out.push("");
  }

  out.push(
    `**Summary:** ${diff.counts.stable} stable · ${diff.counts.changed} changed · ${diff.counts.new} new`,
  );
  return out.join("\n");
}

// ── JSON ────────────────────────────────────────────────────────────────────

export function renderJson(ctx: ReplayRenderContext, opts: ReplayRenderOptions): string {
  const { trace, diff } = ctx;
  const payload: Record<string, unknown> = {
    trace_id: trace.trace_id,
    query: trace.query,
    traced_at: trace.queried_at,
    replayed_at: ctx.replayedAt,
    summary: {
      stable: diff.counts.stable,
      changed: diff.counts.changed,
      removed: diff.counts.removed,
      new: diff.counts.new,
      original_total: diff.counts.originalTotal,
      current_total: diff.counts.currentTotal,
      drift_ratio: Number(diff.driftRatio.toFixed(4)),
      significant_drift: diff.significantDrift,
    },
    diff: {
      stable: diff.stable,
      changed: diff.changed,
      new: diff.added,
    },
  };
  if (opts.compare) {
    payload.original_claims = ctx.original;
    payload.current_claims = ctx.current;
  }
  return JSON.stringify(payload, null, 2);
}

export function renderReplay(
  ctx: ReplayRenderContext,
  format: "pretty" | "markdown" | "json",
  opts: ReplayRenderOptions,
): string {
  if (format === "json") return renderJson(ctx, opts);
  if (format === "markdown") return renderMarkdown(ctx, opts);
  return renderPretty(ctx, opts);
}

export type { ProvenanceTrace };
