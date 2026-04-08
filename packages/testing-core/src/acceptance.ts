import type { GoalRunRecord } from "./run.js";

/** Verdict for one business acceptance criterion after a run. */
export type AcceptanceCriterionVerdict =
  | "passed"
  | "failed"
  | "indeterminate"
  | "not_covered"
  /** Criterion was not in the `--ac` filter for this invocation. */
  | "skipped";

/** Declared in suite config (`acceptance_criteria`). */
export interface AcceptanceCriterionDefinition {
  id: string;
  text: string;
}

/** Per-criterion outcome written to `RunRecord.acceptanceResults`. */
export interface AcceptanceCriterionResult {
  id: string;
  text: string;
  verdict: AcceptanceCriterionVerdict;
  summary?: string;
  evidenceRefs: string[];
  coveredByGoalIds: string[];
}

function worstVerdict(a: AcceptanceCriterionVerdict, b: AcceptanceCriterionVerdict): AcceptanceCriterionVerdict {
  const rank: Record<AcceptanceCriterionVerdict, number> = {
    passed: 0,
    skipped: 1,
    not_covered: 2,
    indeterminate: 3,
    failed: 4,
  };
  return rank[a] >= rank[b] ? a : b;
}

function goalVerdictToAcVerdict(v: GoalRunRecord["verdict"]): AcceptanceCriterionVerdict {
  if (v === "passed") return "passed";
  if (v === "failed") return "failed";
  return "indeterminate";
}

/**
 * Roll up goal outcomes onto suite acceptance criteria.
 * Goals link via {@link GoalRunRecord.acceptanceCriterionIds} (copied from config).
 */
export function aggregateAcceptanceCriterionResults(
  definitions: AcceptanceCriterionDefinition[] | undefined,
  goalRuns: GoalRunRecord[],
  options?: { criterionFilter?: Set<string> },
): AcceptanceCriterionResult[] | undefined {
  if (definitions === undefined || definitions.length === 0) return undefined;
  const filter = options?.criterionFilter;

  return definitions.map((def) => {
    if (filter !== undefined && !filter.has(def.id)) {
      return {
        id: def.id,
        text: def.text,
        verdict: "skipped" as const,
        summary: "Not in --ac filter for this run",
        evidenceRefs: [],
        coveredByGoalIds: [],
      };
    }

    const covering = goalRuns.filter((gr) => gr.acceptanceCriterionIds?.includes(def.id));
    if (covering.length === 0) {
      return {
        id: def.id,
        text: def.text,
        verdict: "not_covered" as const,
        summary: "No goal lists this criterion in acceptance_criterion_ids",
        evidenceRefs: [],
        coveredByGoalIds: [],
      };
    }

    let verdict: AcceptanceCriterionVerdict = "passed";
    const summaries: string[] = [];
    const evidence = new Set<string>();
    const goalIds: string[] = [];

    for (const gr of covering) {
      goalIds.push(gr.goalId);
      const stepsFor = (gr.acSequenceSteps ?? []).filter((s) => s.criterionId === def.id);
      if (stepsFor.length > 0) {
        for (const s of stepsFor) {
          verdict = worstVerdict(verdict, goalVerdictToAcVerdict(s.verdict));
          summaries.push(`${gr.goalId}: ${s.summary}`);
          for (const e of s.evidenceRefs) evidence.add(e);
        }
      } else {
        verdict = worstVerdict(verdict, goalVerdictToAcVerdict(gr.verdict));
        if (gr.summary) summaries.push(`${gr.goalId}: ${gr.summary}`);
        for (const e of gr.evidenceRefs) evidence.add(e);
      }
    }

    return {
      id: def.id,
      text: def.text,
      verdict,
      summary: summaries.length > 0 ? summaries.join(" · ") : undefined,
      evidenceRefs: [...evidence],
      coveredByGoalIds: goalIds,
    };
  });
}
