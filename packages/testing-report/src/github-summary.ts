import type { RunRecord, SuiteReportSlice } from "@restormel/testing-core";
import { inferFailureBucket } from "./failure-bucket.js";

function mdEscapeOneLine(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export interface GithubSummaryContext {
  run: RunRecord;
  suite?: SuiteReportSlice;
  warnings?: string[];
  /** Shown under the title (e.g. PR, target URL from CI). */
  ciContext?: { prNumber?: string; targetUrl?: string };
  /** Single-line bash snippet for triage. */
  reproduceCommand?: string;
  /** Run artefact directory (for upload-artifact hints). */
  artifactDirHint?: string;
}

/**
 * Markdown tuned for `$GITHUB_STEP_SUMMARY`: short, scannable, actionable.
 */
export function buildGithubStepSummaryMarkdown(ctx: GithubSummaryContext): string {
  const { run, suite, warnings, ciContext, reproduceCommand, artifactDirHint } = ctx;
  const lines: string[] = [];

  lines.push(`## Restormel Testing`);
  lines.push("");
  if (ciContext?.prNumber !== undefined) {
    lines.push(`**PR:** #${ciContext.prNumber}`);
  }
  lines.push(`**Verdict:** **${run.verdict}** · **Run** \`${run.id}\``);
  lines.push(`**Suite** \`${run.suiteId}\` · **Env** \`${run.environmentId}\``);
  if (ciContext?.targetUrl !== undefined) {
    lines.push(`**Target URL:** \`${ciContext.targetUrl}\``);
  }
  lines.push(`**Commit:** \`${run.commitSha ?? "n/a"}\` · **Repository:** \`${run.repository ?? "n/a"}\``);
  lines.push("");
  lines.push(`*Execution: inline in this job (no hosted orchestration).*`);
  lines.push("");

  if (run.acceptanceResults !== undefined && run.acceptanceResults.length > 0) {
    const badAc = run.acceptanceResults.filter((a) => a.verdict !== "passed" && a.verdict !== "skipped");
    if (badAc.length > 0) {
      lines.push(`### Acceptance criteria (needs attention)`);
      lines.push("");
      for (const a of badAc) {
        lines.push(`- **\`${a.id}\`** — ${a.verdict} — ${mdEscapeOneLine(a.text)}`);
        if (a.summary) lines.push(`  - ${mdEscapeOneLine(a.summary)}`);
      }
      lines.push("");
    }
  }

  const failed = run.goalRuns.filter((g) => g.verdict !== "passed");
  if (failed.length > 0) {
    lines.push(`### Needs attention`);
    lines.push("");
    for (const g of failed) {
      const bucket = inferFailureBucket(g.reasonCode, g.verdict);
      lines.push(`- **\`${g.goalId}\`** — ${g.verdict} (**${bucket}**) — ${g.summary}`);
      if (g.evidenceRefs.length > 0) {
        lines.push(`  - Evidence: \`${g.evidenceRefs.join("`, `")}\``);
      }
      if (g.retriesUsed > 0) {
        lines.push(`  - Retries used: ${g.retriesUsed}`);
      }
    }
    lines.push("");
  }

  lines.push(`### All goals`);
  lines.push("");
  lines.push(`| Goal | Result | Bucket |`);
  lines.push(`|------|--------|--------|`);
  for (const g of run.goalRuns) {
    const bucket = inferFailureBucket(g.reasonCode, g.verdict);
    lines.push(`| ${g.goalId} | ${g.verdict} | ${bucket} |`);
  }
  lines.push("");

  if (suite?.userStory !== undefined && suite.userStory.trim() !== "") {
    lines.push(`### User story`);
    lines.push("");
    lines.push(mdEscapeOneLine(suite.userStory.trim()));
    lines.push("");
  }

  if (suite?.description) {
    lines.push(`### Suite note`);
    lines.push("");
    lines.push(suite.description);
    lines.push("");
  }

  if (run.keysModelMeta !== undefined && run.keysModelMeta.length > 0) {
    lines.push(`### Models (Keys)`);
    lines.push("");
    for (const m of run.keysModelMeta) {
      lines.push(
        `- \`${m.logicalRef}\` → ${m.provider ?? "?"}/${m.model ?? "?"} (${m.invocationCount ?? 0} calls, ${m.resolutionSource ?? "?"})`,
      );
    }
    lines.push("");
  }

  if (warnings !== undefined && warnings.length > 0) {
    lines.push(`### Warnings`);
    lines.push("");
    for (const w of warnings) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  if (reproduceCommand !== undefined && reproduceCommand.length > 0) {
    lines.push(`### Reproduce locally`);
    lines.push("");
    lines.push("```bash");
    lines.push(reproduceCommand);
    lines.push("```");
    lines.push("");
  }

  if (artifactDirHint !== undefined && artifactDirHint.length > 0) {
    lines.push(`Upload **${artifactDirHint}** with \`actions/upload-artifact\` for full outputs (screenshots, \`run.json\`, \`report.json\`, \`junit.xml\`, …).`);
    lines.push("");
  } else {
    lines.push(`_Artefacts include \`report.json\`, \`summary.md\`, \`junit.xml\`, traces, screenshots (if any)._`);
  }

  return lines.join("\n");
}
