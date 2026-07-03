/**
 * Entitlements: check() and getAvailableModels() with glob pattern support.
 */
import type { KeysConfig, PlanDefinition, EntitlementResult } from "./types.js";

/** Convert glob pattern to RegExp (e.g. gpt-4o* -> /^gpt-4o.*$/). */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function getModelPatterns(config: KeysConfig): string[] {
  const plans = (config.plans ?? []) as PlanDefinition[];
  const patterns: string[] = [];
  for (const plan of plans) {
    const ent = plan.entitlements as { allowedModels?: string[] } | undefined;
    const models = ent?.allowedModels ?? (ent as { models?: string[] } | undefined)?.models ?? [];
    patterns.push(...models);
  }
  if (patterns.length === 0 && (config.models?.length ?? 0) > 0) {
    const defs = config.models ?? [];
    for (const m of defs) {
      if (typeof m === "object" && m && "id" in m) patterns.push((m as { id: string }).id);
    }
  }
  return patterns;
}

export interface Entitlements {
  check(modelId: string): EntitlementResult;
  getAvailableModels(candidateModelIds: string[]): string[];
}

/**
 * Create entitlements from config. Glob patterns (e.g. gpt-4o*) match model ids.
 */
export function createEntitlements(config: KeysConfig): Entitlements {
  const patterns = getModelPatterns(config);
  const regexes = patterns.map((p) => ({ pattern: p, re: globToRegExp(p) }));

  function matches(modelId: string): boolean {
    return regexes.some(({ re }) => re.test(modelId));
  }

  return {
    check(modelId: string): EntitlementResult {
      const allowed = matches(modelId);
      return { allowed, remaining: allowed ? undefined : 0, limit: allowed ? undefined : 0 };
    },

    getAvailableModels(candidateModelIds: string[]): string[] {
      return candidateModelIds.filter((id) => matches(id));
    },
  };
}
