import type { SuccessCriteria } from "@restormel/testing-core";

/**
 * Logical ref for Keys resolution when a goal uses `judge_rubric`.
 * Order: explicit `model_ref` on the rubric, then common slots on the merged environment keys map.
 */
export function judgeLogicalRefForCriteria(
  criteria: SuccessCriteria,
  resolvedKeys: Record<string, string>,
): string | undefined {
  const jr = criteria.judgeRubric;
  if (!jr) return undefined;
  if (jr.modelRef) return jr.modelRef;
  return (
    resolvedKeys.llm_primary ??
    resolvedKeys.llmPrimary ??
    resolvedKeys.judge ??
    resolvedKeys.llm_judge ??
    resolvedKeys.llmJudge
  );
}
