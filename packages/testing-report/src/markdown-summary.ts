import type { RunRecord, SuiteReportSlice } from "@restormel/testing-core";
import { inferFailureBucket } from "./failure-bucket.js";

export interface MarkdownSummaryOptions {
  run: RunRecord;
  suite?: SuiteReportSlice;
  warnings?: string[];
  /** Extra front-matter lines after title (e.g. CI context). */
  preamble?: string[];
}

function mdEscapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * Full markdown report for humans (`summary.md`).
 */
export function buildMarkdownSummary(opts: MarkdownSummaryOptions): string {
  const { run, suite, warnings, preamble } = opts;
  const lines: string[] = [];

  lines.push(`# Restormel Testing run`);
  lines.push("");
  lines.push(`- **Run id:** \`${run.id}\``);
  lines.push(`- **Verdict:** **${run.verdict}**`);
  lines.push(`- **Suite:** \`${run.suiteId}\``);
  lines.push(`- **Environment:** \`${run.environmentId}\``);
  lines.push(`- **Trigger:** \`${run.trigger}\``);
  if (run.startedAt) lines.push(`- **Started:** ${run.startedAt}`);
  if (run.endedAt) lines.push(`- **Ended:** ${run.endedAt}`);
  if (run.commitSha) lines.push(`- **Commit:** \`${run.commitSha}\``);
  if (run.repository) lines.push(`- **Repository:** \`${run.repository}\``);
  lines.push("");

  if (preamble !== undefined && preamble.length > 0) {
    for (const p of preamble) {
      lines.push(p);
    }
    lines.push("");
  }

  if (suite !== undefined) {
    lines.push(`## Suite`);
    lines.push("");
    if (suite.description) lines.push(suite.description);
    else lines.push(`_(no description)_`);
    lines.push("");
    if (suite.userStory !== undefined && suite.userStory.trim() !== "") {
      lines.push(`### User story`);
      lines.push("");
      lines.push(suite.userStory.trim());
      lines.push("");
    }
    if (suite.tags !== undefined && suite.tags.length > 0) {
      lines.push(`**Tags:** ${suite.tags.map((t) => `\`${t}\``).join(", ")}`);
      lines.push("");
    }
    lines.push(`**Goals in run:** ${suite.goalCount}`);
    lines.push("");
  }

  if (run.acceptanceResults !== undefined && run.acceptanceResults.length > 0) {
    lines.push(`## Acceptance criteria`);
    lines.push("");
    lines.push(`| AC id | Criterion | Result | Evidence | Covered by goals |`);
    lines.push(`|-------|-----------|--------|----------|------------------|`);
    for (const a of run.acceptanceResults) {
      const ev = a.evidenceRefs.length ? a.evidenceRefs.join(", ") : "—";
      const gids = a.coveredByGoalIds.length ? a.coveredByGoalIds.map((g) => `\`${g}\``).join(", ") : "—";
      lines.push(
        `| \`${mdEscapeCell(a.id)}\` | ${mdEscapeCell(a.text)} | **${a.verdict}** | ${mdEscapeCell(ev)} | ${gids} |`,
      );
    }
    lines.push("");
  }

  const v = run.verdict;
  const counts = { passed: 0, failed: 0, indeterminate: 0 };
  for (const g of run.goalRuns) {
    if (g.verdict === "passed") counts.passed++;
    else if (g.verdict === "failed") counts.failed++;
    else counts.indeterminate++;
  }
  lines.push(`## Verdict summary`);
  lines.push("");
  lines.push(`| Overall | Passed | Failed | Indeterminate | Total |`);
  lines.push(`|--------|--------|--------|---------------|-------|`);
  lines.push(
    `| **${v}** | ${counts.passed} | ${counts.failed} | ${counts.indeterminate} | ${run.goalRuns.length} |`,
  );
  lines.push("");

  lines.push(`## Goals`);
  lines.push("");
  lines.push(`| Goal | Verdict | Bucket | Retries | Evidence | Reason / summary |`);
  lines.push(`|------|---------|--------|---------|----------|------------------|`);
  for (const g of run.goalRuns) {
    const bucket = inferFailureBucket(g.reasonCode, g.verdict);
    const ev = g.evidenceRefs.length ? g.evidenceRefs.join(", ") : "—";
    const summary = mdEscapeCell(g.summary || g.reasonCode);
    lines.push(
      `| \`${g.goalId}\` | ${g.verdict} | ${bucket} | ${g.retriesUsed} | ${mdEscapeCell(ev)} | ${summary} |`,
    );
  }
  lines.push("");

  if (run.keysModelMeta !== undefined && run.keysModelMeta.length > 0) {
    lines.push(`## Keys / model metadata (no secrets)`);
    lines.push("");
    lines.push(`| Logical ref | Provider | Model | Invocations | Source |`);
    lines.push(`|-------------|----------|-------|-------------|--------|`);
    for (const m of run.keysModelMeta) {
      lines.push(
        `| \`${mdEscapeCell(m.logicalRef)}\` | ${m.provider ?? "—"} | ${m.model ?? "—"} | ${m.invocationCount ?? 0} | ${m.resolutionSource ?? "—"} |`,
      );
    }
    lines.push("");
  }

  if (run.judgeInvocationCount !== undefined && run.judgeInvocationCount > 0) {
    lines.push(`## Judge / rubric`);
    lines.push("");
    lines.push(`- **Invocation count:** ${run.judgeInvocationCount} (factual)`);
    lines.push("");
  }

  if (run.costEstimate?.tokenEstimate !== undefined) {
    lines.push(`## Rough token scale (heuristic only)`);
    lines.push("");
    const out = run.costEstimate.tokenEstimate.output ?? 0;
    const inn = run.costEstimate.tokenEstimate.input ?? 0;
    lines.push(
      `- **Not billing-grade:** input ${inn}, output ${out} — MVP placeholder from invocation count; do not use for spend accounting.`,
    );
    lines.push("");
  }

  if (warnings !== undefined && warnings.length > 0) {
    lines.push(`## Warnings`);
    lines.push("");
    for (const w of warnings) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  lines.push(`## Artefact files`);
  lines.push("");
  lines.push(`In this run directory: \`run.json\`, \`traces.json\`, \`report.json\`, \`summary.md\`, \`github-summary.md\`, \`junit.xml\`, optional \`warnings.txt\`.`);
  lines.push("");

  return lines.join("\n");
}
