import type { AcSequenceStepResult } from "./ac-sequence.js";
import type { GoalRunRecord } from "./run.js";
import type { Report } from "./report.js";
import type { RunRecord } from "./run.js";
import type { TraceEvent } from "./run.js";
import { isVerdict } from "./verdict.js";

function isAcSequenceStepResult(value: unknown): value is AcSequenceStepResult {
  if (value === null || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.criterionId === "string" &&
    isVerdict(s.verdict) &&
    typeof s.reasonCode === "string" &&
    typeof s.summary === "string" &&
    typeof s.agentRoundsUsed === "number" &&
    Array.isArray(s.evidenceRefs) &&
    s.evidenceRefs.every((x) => typeof x === "string")
  );
}

export function isGoalRunRecord(value: unknown): value is GoalRunRecord {
  if (value === null || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  const acOk =
    g.acceptanceCriterionIds === undefined ||
    (Array.isArray(g.acceptanceCriterionIds) && g.acceptanceCriterionIds.every((x) => typeof x === "string"));
  const seqOk =
    g.acSequenceSteps === undefined ||
    (Array.isArray(g.acSequenceSteps) && g.acSequenceSteps.every(isAcSequenceStepResult));
  return (
    typeof g.goalId === "string" &&
    isVerdict(g.verdict) &&
    typeof g.reasonCode === "string" &&
    typeof g.summary === "string" &&
    typeof g.retriesUsed === "number" &&
    Array.isArray(g.evidenceRefs) &&
    g.evidenceRefs.every((x) => typeof x === "string") &&
    acOk &&
    seqOk
  );
}

export function isRunRecord(value: unknown): value is RunRecord {
  if (value === null || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.suiteId === "string" &&
    typeof r.environmentId === "string" &&
    (r.trigger === "local" || r.trigger === "ci") &&
    typeof r.startedAt === "string" &&
    isVerdict(r.verdict) &&
    Array.isArray(r.goalRuns) &&
    r.goalRuns.every(isGoalRunRecord)
  );
}

export function isTraceEvent(value: unknown): value is TraceEvent {
  if (value === null || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  const kinds = [
    "navigation",
    "action",
    "assertion",
    "model_call",
    "tool_call",
    "observation",
    "error",
  ] as const;
  return (
    typeof t.id === "string" &&
    typeof t.runId === "string" &&
    typeof t.goalId === "string" &&
    typeof t.stepIndex === "number" &&
    typeof t.kind === "string" &&
    (kinds as readonly string[]).includes(t.kind) &&
    typeof t.timestamp === "string" &&
    typeof t.summary === "string"
  );
}

export function isReport(value: unknown): value is Report {
  if (value === null || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  if (!isRunRecord(p.run)) return false;
  if (!Array.isArray(p.highlights) || !p.highlights.every((x) => typeof x === "string")) {
    return false;
  }
  if (!Array.isArray(p.artifacts)) return false;
  for (const a of p.artifacts) {
    if (a === null || typeof a !== "object") return false;
    const ar = a as Record<string, unknown>;
    const kinds = [
      "screenshot",
      "trace",
      "log",
      "network",
      "console",
      "report",
      "other",
    ] as const;
    if (typeof ar.kind !== "string" || !(kinds as readonly string[]).includes(ar.kind)) {
      return false;
    }
    if (typeof ar.path !== "string") return false;
  }
  return true;
}
