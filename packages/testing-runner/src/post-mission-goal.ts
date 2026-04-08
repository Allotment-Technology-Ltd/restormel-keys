import type { TestGoal } from "@restormel/testing-core";

/**
 * After `mission_executor` exits 0, browser evaluation uses this goal: agent-only fields removed,
 * navigation path is `after_agent.start_path` when set, otherwise the goal's top-level `start_path`.
 */
export function toPostMissionObserveGoal(goal: TestGoal): TestGoal {
  const startPath = goal.afterAgent?.startPath ?? goal.startPath;
  return {
    id: goal.id,
    type: goal.type,
    description: goal.description,
    successCriteria: goal.successCriteria,
    startPath,
    executionMode: "observe",
    preconditions: goal.preconditions,
    cleanup: goal.cleanup,
    exclusiveWith: goal.exclusiveWith,
    tags: goal.tags,
    ...(goal.acceptanceCriterionIds !== undefined && goal.acceptanceCriterionIds.length > 0
      ? { acceptanceCriterionIds: [...goal.acceptanceCriterionIds] }
      : {}),
  };
}
