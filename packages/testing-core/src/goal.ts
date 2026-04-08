import type { SuccessCriteria } from "./success-criteria.js";

export type GoalType = "browser" | "performance" | "native";

/** Opaque hook identifier (script id, npm script name, etc.). */
export type HookRef = string;

export interface TestGoal {
  id: string;
  type: GoalType;
  description: string;
  successCriteria: SuccessCriteria;
  preconditions?: HookRef[];
  cleanup?: HookRef[];
  exclusiveWith?: string[];
  tags?: string[];
}
