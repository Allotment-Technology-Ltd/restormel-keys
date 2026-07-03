import { randomUUID } from "node:crypto";
import type { TraceEvent } from "@restormel/testing-core";
import type { BrowserSessionTraceEntry } from "./types.js";

/** Map browser adapter trace lines into core `TraceEvent` records for run reports. */
export function browserTracesToCoreEvents(
  entries: readonly BrowserSessionTraceEntry[],
  ctx: { runId: string; goalId: string; startingStepIndex: number },
): TraceEvent[] {
  return entries.map((e, i) => ({
    id: randomUUID(),
    runId: ctx.runId,
    goalId: ctx.goalId,
    stepIndex: ctx.startingStepIndex + i,
    kind: e.kind,
    timestamp: e.timestamp,
    summary: e.summary,
    metadata: e.metadata,
  }));
}
