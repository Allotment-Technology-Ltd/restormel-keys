/**
 * Minimal second-consumer pattern: domain-scoped memory for a non-SOPHIA app
 * (e.g. plotbudget, allotment.works) using the same event + projection API.
 */
import {
  projectWorkingMemory,
  workingMemoryToDebugJson,
  workingMemoryToPromptBlock,
  type StateEvent,
} from "@restormel/state";

const policy = { maxCellsPerScope: 6, maxApproxTokensPerScope: 1200 };

const events: StateEvent[] = [
  {
    type: "memory_cell_upsert",
    id: "e-budget-1",
    ts: "2026-04-09T10:00:00.000Z",
    scope: "plotbudget_month",
    cell_id: "income-note",
    text: "User confirmed monthly income band (redacted).",
    run_id: "demo-run",
  },
  {
    type: "memory_cell_upsert",
    id: "e-budget-2",
    ts: "2026-04-09T10:01:00.000Z",
    scope: "plotbudget_month",
    cell_id: "goal-note",
    text: "Savings goal: emergency fund target set.",
    run_id: "demo-run",
  },
  {
    type: "memory_summarize_compact",
    id: "e-budget-sum",
    ts: "2026-04-09T10:05:00.000Z",
    scope: "plotbudget_month",
    remove_cell_ids: ["income-note", "goal-note"],
    summary_cell_id: "month-summary",
    summary_text: "User set income band and emergency fund goal.",
    run_id: "demo-run",
  },
];

const view = projectWorkingMemory(events, policy);
console.log("prompt_block:\n", workingMemoryToPromptBlock(view, ["plotbudget_month"]));
console.log("debug_json:\n", JSON.stringify(workingMemoryToDebugJson(view), null, 2));
