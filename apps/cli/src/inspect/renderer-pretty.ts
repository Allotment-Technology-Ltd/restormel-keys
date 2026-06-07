/**
 * renderer-pretty — colourised terminal rendering of an InspectResult, legible
 * on a dark terminal. Wraps long claim text under a fixed gutter so the marker
 * column stays aligned.
 */
import chalk from "chalk";
import type { ClaimView, InspectResult } from "./types.js";

const RULE = "─".repeat(60);
const GUTTER = 22;

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

/** Wrap text to a width, indenting continuation lines to the gutter column. */
function wrap(text: string, width: number, indent: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > width && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  const pad = " ".repeat(indent);
  return lines.map((l, i) => (i === 0 ? l : pad + l));
}

function categoryMarker(claim: ClaimView): string {
  if (claim.category === "supported") {
    return chalk.green("✓ SUPPORTED");
  }
  if (claim.category === "weak") {
    return chalk.yellow("~ WEAK     ");
  }
  return chalk.red("✗ UNSUPPORTED");
}

function score(claim: ClaimView): string {
  return chalk.dim(`[${claim.trustScore.toFixed(2)}]`);
}

function renderRetrievedClaim(claim: ClaimView, lines: string[]): void {
  const marker = categoryMarker(claim);
  const head = `${marker}  ${score(claim)}  `;
  const wrapped = wrap(claim.claimText, 50, GUTTER + 9);
  lines.push(`${head}${wrapped[0]}`);
  for (let i = 1; i < wrapped.length; i++) lines.push(wrapped[i]);
  const indent = " ".repeat(GUTTER + 9);
  lines.push(chalk.dim(`${indent}Source: ${claim.sourceRef}`));
  lines.push(chalk.dim(`${indent}Depth: ${claim.hopDepth} · Via: ${claim.via}`));
  if (claim.note) lines.push(chalk.cyan(`${indent}Note: ${claim.note}`));
  lines.push("");
}

function renderFilteredClaim(claim: ClaimView, lines: string[]): void {
  let label: string;
  if (claim.filterReasonCode === "below-threshold") {
    label = chalk.red("✗ BELOW THRESHOLD") + "  " + chalk.dim(`[${claim.trustScore.toFixed(2)}]`);
  } else {
    label = chalk.red("✗ UNSUPPORTED     ");
  }
  const wrapped = wrap(claim.claimText, 50, GUTTER + 4);
  lines.push(`${label}  ${wrapped[0]}`);
  for (let i = 1; i < wrapped.length; i++) lines.push(wrapped[i]);
  const indent = " ".repeat(GUTTER + 4);
  if (claim.filterReason) lines.push(chalk.dim(`${indent}Reason: ${claim.filterReason}`));
  lines.push(chalk.dim(`${indent}Source: ${claim.sourceRef}`));
  lines.push("");
}

export function renderPretty(result: InspectResult, quiet: boolean): string {
  const lines: string[] = [];
  const t = result.traceSummary;

  lines.push(chalk.gray(RULE));
  lines.push(chalk.bold.white("RESTORMEL INSPECT"));
  lines.push(`${chalk.dim("Query:")} ${chalk.white(`"${result.query}"`)}`);
  const meta: string[] = [];
  if (result.workspace) meta.push(`Workspace: ${result.workspace}`);
  if (result.domain) meta.push(`Domain: ${result.domain}`);
  if (meta.length) lines.push(chalk.dim(meta.join(" · ")));
  lines.push(chalk.gray(RULE));
  lines.push("");

  lines.push(
    chalk.bold.green(
      `WOULD RETRIEVE (${result.wouldRetrieve.length} claims · ${fmtNum(t.tokensUsed)} tokens)`,
    ),
  );
  lines.push("");
  if (result.wouldRetrieve.length === 0) {
    lines.push(chalk.dim("  (none under the current policy)"));
    lines.push("");
  } else {
    for (const claim of result.wouldRetrieve) renderRetrievedClaim(claim, lines);
  }

  if (!quiet && result.filteredOut.length > 0) {
    lines.push(chalk.bold.red(`FILTERED OUT (${result.filteredOut.length} claims)`));
    lines.push("");
    for (const claim of result.filteredOut) renderFilteredClaim(claim, lines);
  }

  lines.push(chalk.gray(RULE));
  lines.push(chalk.bold.white("TRAVERSAL SUMMARY"));
  lines.push(
    chalk.dim(
      `Seeds: ${t.seedCount} · Hops: ${t.hops} · Candidates evaluated: ${t.candidatesEvaluated}`,
    ),
  );
  lines.push(
    chalk.dim(
      `Retrieved: ${t.retrieved} · Filtered: ${t.filtered} · Tokens: ${fmtNum(t.tokensUsed)} / ${fmtNum(t.tokenBudget)} budget`,
    ),
  );
  if (t.truncated) {
    lines.push(
      chalk.yellow(
        `Note: result truncated to token budget. Use --max-tokens to adjust.`,
      ),
    );
  }
  lines.push(chalk.gray(RULE));

  return lines.join("\n");
}
