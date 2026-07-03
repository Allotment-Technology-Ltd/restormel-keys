import type { RunRecord } from "@restormel/testing-core";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function durationSeconds(run: RunRecord): number {
  if (!run.startedAt || !run.endedAt) return 0;
  const a = Date.parse(run.startedAt);
  const b = Date.parse(run.endedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.max(0, (b - a) / 1000);
}

/**
 * Minimal JUnit XML: one `<testcase>` per goal. `failed` → `<failure>`, `indeterminate` → `<error>`.
 */
export function buildJUnitXml(run: RunRecord): string {
  const suiteName = xmlEscape(run.suiteId);
  const n = run.goalRuns.length;
  const failures = run.goalRuns.filter((g) => g.verdict === "failed").length;
  const errors = run.goalRuns.filter((g) => g.verdict === "indeterminate").length;
  const time = durationSeconds(run).toFixed(3);

  const cases: string[] = [];
  for (const g of run.goalRuns) {
    const name = xmlEscape(g.goalId);
    const className = xmlEscape(`${run.suiteId}.${g.goalId}`);
    const body = `${xmlEscape(g.reasonCode)}: ${xmlEscape(g.summary)}`;
    let inner = "";
    if (g.verdict === "failed") {
      inner = `\n      <failure message="${xmlEscape(g.reasonCode)}" type="failed">${body}</failure>`;
    } else if (g.verdict === "indeterminate") {
      inner = `\n      <error message="${xmlEscape(g.reasonCode)}" type="indeterminate">${body}</error>`;
    }
    if (g.retriesUsed > 0) {
      inner += `\n      <!-- retries_used=${g.retriesUsed} -->`;
    }
    if (g.evidenceRefs.length > 0) {
      inner += `\n      <!-- evidence: ${xmlEscape(g.evidenceRefs.join(", "))} -->`;
    }
    cases.push(`    <testcase name="${name}" classname="${className}" time="0">${inner}\n    </testcase>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${suiteName}" tests="${n}" failures="${failures}" errors="${errors}" time="${time}">
${cases.join("\n")}
  </testsuite>
</testsuites>
`;
}
