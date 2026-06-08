/**
 * Verification rule-set resolution (Stage 4C).
 *
 * Resolves the effective {@link VerificationRuleSet} for a workspace/domain pack and classifies an
 * overall reasoning score (0–1) as supported / weak / unsupported under a chosen policy.
 */
import type {
  DomainPackVerificationRules,
  VerificationRuleSet,
  VerificationRulePolicy,
} from "@restormel/contracts/verification-rules";
import type { ReasoningDimension } from "@restormel/contracts/verification";
import { RESTORMEL_CORE_RULE_SET } from "./core.js";

export { RESTORMEL_CORE_RULE_SET, RESTORMEL_CORE_RULE_SET_ID } from "./core.js";

/** All rule sets shipped with the engine. The registry (Phase 4) will extend this. */
export const BUILT_IN_RULE_SETS: readonly VerificationRuleSet[] = [RESTORMEL_CORE_RULE_SET];

export function getBuiltInRuleSet(id: string): VerificationRuleSet | undefined {
  return BUILT_IN_RULE_SETS.find((rs) => rs.id === id);
}

/** Sum of a rule set's dimension weights (a valid rule set sums to ~1.0). */
export function dimensionWeightSum(rs: VerificationRuleSet): number {
  return Number(rs.dimensions.reduce((s, d) => s + d.weight, 0).toFixed(6));
}

/**
 * Resolve the effective rule set for an optional domain-pack override.
 * Order: (1) inline dimension overrides, (2) referenced rule set id, (3) built-in core default.
 */
export function resolveVerificationRuleSet(
  override?: DomainPackVerificationRules | null,
): VerificationRuleSet {
  if (!override) return RESTORMEL_CORE_RULE_SET;
  if (override.type === "rule_set_ref") {
    return getBuiltInRuleSet(override.rule_set_id) ?? RESTORMEL_CORE_RULE_SET;
  }
  return applyInlineOverrides(RESTORMEL_CORE_RULE_SET, override.dimension_overrides);
}

/** Re-weight the base dimensions with inline overrides, then renormalise to sum 1.0. */
function applyInlineOverrides(
  base: VerificationRuleSet,
  overrides: Partial<Record<ReasoningDimension, number>>,
): VerificationRuleSet {
  const merged = base.dimensions.map((d) => ({ ...d, weight: overrides[d.id] ?? d.weight }));
  const total = merged.reduce((s, d) => s + d.weight, 0) || 1;
  const dimensions = merged.map((d) => ({ ...d, weight: Number((d.weight / total).toFixed(6)) }));
  return {
    ...base,
    id: `${base.id}+inline`,
    name: `${base.name} (domain override)`,
    dimensions,
  };
}

export type ClaimVerificationClass = "supported" | "weak" | "unsupported";

/** Classify an overall reasoning score (0–1) under a policy's thresholds. */
export function classifyByPolicy(
  overall: number,
  policy: VerificationRulePolicy,
): ClaimVerificationClass {
  if (overall >= policy.min_overall_score) return "supported";
  if (overall >= policy.weak_threshold) return "weak";
  return "unsupported";
}

/** Pick a policy by id/name, defaulting to 'balanced' then the first declared policy. */
export function selectPolicy(rs: VerificationRuleSet, policyId?: string): VerificationRulePolicy {
  if (policyId) {
    const found = rs.policies.find((p) => p.id === policyId || p.name === policyId);
    if (found) return found;
  }
  return rs.policies.find((p) => p.name === "balanced") ?? rs.policies[0];
}
