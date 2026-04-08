import type { RunRecord } from "@restormel/testing-core";
import { inferFailureBucket } from "./failure-bucket.js";

/**
 * Human-readable summary for terminals and logs. Omits secrets (none in RunRecord).
 */
export function formatRunSummaryLines(run: RunRecord): string[] {
  const lines: string[] = [];
  lines.push(`Run ${run.id}`);
  lines.push(`  suite:        ${run.suiteId}`);
  lines.push(`  environment:  ${run.environmentId}`);
  lines.push(`  trigger:      ${run.trigger}`);
  lines.push(`  verdict:      ${run.verdict}`);
  if (run.startedAt) lines.push(`  started:      ${run.startedAt}`);
  if (run.endedAt) lines.push(`  ended:        ${run.endedAt}`);
  if (run.commitSha) lines.push(`  commit:       ${run.commitSha}`);
  if (run.repository) lines.push(`  repository:   ${run.repository}`);
  lines.push("  goals:");
  for (const g of run.goalRuns) {
    const ev = g.evidenceRefs.length ? ` [${g.evidenceRefs.length} artefact(s)]` : "";
    const bucket = inferFailureBucket(g.reasonCode, g.verdict);
    lines.push(
      `    - ${g.goalId}: ${g.verdict} (${g.reasonCode}) bucket=${bucket} retries=${g.retriesUsed}${ev}`,
    );
    if (g.summary) {
      lines.push(`      ${g.summary}`);
    }
  }
  if (run.keysModelMeta !== undefined && run.keysModelMeta.length > 0) {
    lines.push("  keys models (no secrets):");
    for (const m of run.keysModelMeta) {
      lines.push(
        `    - ${m.logicalRef} provider=${m.provider ?? "?"} model=${m.model ?? "?"} invocations=${m.invocationCount ?? 0}`,
      );
    }
  }
  return lines;
}

export function formatRunSummary(run: RunRecord): string {
  return formatRunSummaryLines(run).join("\n");
}
