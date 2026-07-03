/**
 * renderer-markdown — a markdown document suitable for pasting into a README or
 * issue. Retrieved claims as a table; filtered claims inside a collapsed
 * <details> block.
 */
import type { ClaimView, InspectResult } from "./types.js";

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function markerFor(claim: ClaimView): string {
  if (claim.category === "supported") return "✓ supported";
  if (claim.category === "weak") return "~ weak";
  return "✗ unsupported";
}

export function renderMarkdown(result: InspectResult): string {
  const t = result.traceSummary;
  const lines: string[] = [];

  lines.push(`# Restormel inspect`);
  lines.push("");
  lines.push(`**Query:** ${escapeCell(result.query)}`);
  const meta: string[] = [];
  if (result.workspace) meta.push(`**Workspace:** ${result.workspace}`);
  if (result.domain) meta.push(`**Domain:** ${result.domain}`);
  if (meta.length) {
    lines.push("");
    lines.push(meta.join(" · "));
  }
  lines.push("");
  lines.push(`## Would retrieve (${result.wouldRetrieve.length} claims · ${t.tokensUsed} tokens)`);
  lines.push("");

  if (result.wouldRetrieve.length === 0) {
    lines.push("_No claims matched under the current policy._");
  } else {
    lines.push("| State | Trust | Claim | Source | Depth |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const c of result.wouldRetrieve) {
      lines.push(
        `| ${markerFor(c)} | ${c.trustScore.toFixed(2)} | ${escapeCell(c.claimText)} | ${escapeCell(c.sourceRef)} | ${c.hopDepth} |`,
      );
    }
  }
  lines.push("");

  if (result.filteredOut.length > 0) {
    lines.push("<details>");
    lines.push(`<summary>Filtered out (${result.filteredOut.length} claims)</summary>`);
    lines.push("");
    lines.push("| State | Trust | Claim | Reason | Source |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const c of result.filteredOut) {
      lines.push(
        `| ${markerFor(c)} | ${c.trustScore.toFixed(2)} | ${escapeCell(c.claimText)} | ${escapeCell(c.filterReason ?? "")} | ${escapeCell(c.sourceRef)} |`,
      );
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  lines.push("## Traversal summary");
  lines.push("");
  lines.push(`- Seeds: ${t.seedCount}`);
  lines.push(`- Hops: ${t.hops}`);
  lines.push(`- Candidates evaluated: ${t.candidatesEvaluated}`);
  lines.push(`- Retrieved: ${t.retrieved} · Filtered: ${t.filtered}`);
  lines.push(`- Tokens: ${t.tokensUsed} / ${t.tokenBudget} budget`);
  if (t.truncated) {
    lines.push(`- Result truncated to token budget — use \`--max-tokens\` to retrieve more.`);
  }
  lines.push("");

  return lines.join("\n");
}
