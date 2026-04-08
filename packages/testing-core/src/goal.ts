import type { SuccessCriteria } from "./success-criteria.js";

export type GoalType = "browser" | "performance" | "native";

/** Opaque hook identifier (script id, npm script name, etc.). */
export type HookRef = string;

export interface TestGoal {
  id: string;
  type: GoalType;
  description: string;
  successCriteria: SuccessCriteria;
  /**
   * Path relative to environment `base_url` for the initial navigation (e.g. `/login`, `dashboard/`).
   * Resolved with `new URL(startPath, baseUrl)`.
   */
  startPath?: string;
  preconditions?: HookRef[];
  cleanup?: HookRef[];
  exclusiveWith?: string[];
  tags?: string[];
}
