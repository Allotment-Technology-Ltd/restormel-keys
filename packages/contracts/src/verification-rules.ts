/**
 * Verification rule set contracts (Stage 4C).
 *
 * A VerificationRuleSet is a versioned, named configuration that captures how each of the six
 * reasoning dimensions is weighted, what prompt template guides the LLM scorer for that dimension,
 * what passing threshold is required, and what policy (strict / balanced / lenient) governs the
 * minimum overall score and weak-claim threshold.
 *
 * The built-in "Restormel Core v1" rule set encodes the REAL weights used by the reasoning-eval
 * pipeline. Domain packs can override individual dimension weights or reference a named rule set.
 */
import { z } from 'zod';
import { ReasoningDimensionSchema } from './verification.js';

// ─── Dimension ───────────────────────────────────────────────────────────────

export const VerificationDimensionSchema = z.object({
  /** One of the six canonical ReasoningDimension identifiers. */
  id: ReasoningDimensionSchema,
  /** Human-readable name for this dimension. */
  name: z.string().min(1),
  /** What this dimension checks and why it matters. */
  description: z.string().min(1),
  /** Relative weight in [0, 1]. All six weights in a rule set MUST sum to 1.0. */
  weight: z.number().min(0).max(1),
  /** The scorer prompt that guides the LLM when evaluating this dimension. */
  prompt_template: z.string().min(1),
  /** Minimum per-dimension score (0–1) for a claim to be considered "passing" on this dimension. */
  passing_threshold: z.number().min(0).max(1)
});

export type VerificationDimension = z.infer<typeof VerificationDimensionSchema>;

// ─── Policy ──────────────────────────────────────────────────────────────────

/**
 * A VerificationRulePolicy governs pass/fail thresholds for the overall score and
 * dimension-level overrides.  Named "VerificationRulePolicy" (not "VerificationPolicy")
 * to avoid collision with the existing retrieve-context VerificationPolicy type.
 */
export const VerificationRulePolicySchema = z.object({
  /** Unique slug for this policy within the rule set (e.g. "balanced"). */
  id: z.string().min(1),
  /** Display name; use 'strict', 'balanced', or 'lenient' as the canonical set. */
  name: z.enum(['strict', 'balanced', 'lenient']),
  /**
   * Minimum overall score (0–1, weighted sum of dimension scores) for a verification
   * result to be considered passing under this policy.
   */
  min_overall_score: z.number().min(0).max(1),
  /**
   * Overall score at or below which a result is flagged as "weak" (passes but warrants
   * scrutiny).  Must be <= min_overall_score.
   */
  weak_threshold: z.number().min(0).max(1),
  /**
   * Per-dimension weight overrides for this policy.  Keys are ReasoningDimension ids;
   * values replace the rule set's base weight when this policy is active.
   */
  dimension_overrides: z.partialRecord(ReasoningDimensionSchema, z.number().min(0).max(1)).optional()
});

export type VerificationRulePolicy = z.infer<typeof VerificationRulePolicySchema>;

// ─── Rule Set ─────────────────────────────────────────────────────────────────

export const VerificationRuleSetSchema = z.object({
  /** Unique stable id for this rule set (e.g. "restormel-core-v1"). */
  id: z.string().min(1),
  /** Human-readable display name. */
  name: z.string().min(1),
  /** Semantic version string (e.g. "1.0.0"). */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be a semver string (MAJOR.MINOR.PATCH)'),
  /** Short description of what this rule set is for. */
  description: z.string().min(1),
  /**
   * Exactly six dimensions, one per ReasoningDimension id.
   * Their weights MUST sum to 1.0 (within floating-point tolerance of 1e-6).
   */
  dimensions: z.array(VerificationDimensionSchema).length(6),
  /** Available policies (strict, balanced, lenient); at least one is required. */
  policies: z.array(VerificationRulePolicySchema).min(1),
  /**
   * Optional list of domain hint strings (e.g. "philosophy", "legal") that
   * this rule set is recommended for.
   */
  domain_hints: z.array(z.string()).optional()
});

export type VerificationRuleSet = z.infer<typeof VerificationRuleSetSchema>;

// ─── Domain-Pack Override ─────────────────────────────────────────────────────

/**
 * The shape that a domain pack uses to override the verification rule set.
 * Either reference a named rule set by id, or supply inline dimension weight overrides.
 * This is the canonical contract shape; the dashboard domain-pack types embed it optionally.
 */
export const DomainPackVerificationRulesSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('rule_set_ref'),
    /** Id of a known built-in or registered rule set to use instead of the core default. */
    rule_set_id: z.string().min(1)
  }),
  z.object({
    type: z.literal('inline_overrides'),
    /**
     * Per-dimension weight overrides.  Weights that are not overridden fall back to
     * the active rule set's defaults.  The merged weights do NOT need to sum to 1.0 in
     * this structure — the resolver normalises them before use.
     */
    dimension_overrides: z.partialRecord(ReasoningDimensionSchema, z.number().min(0).max(1))
  })
]);

export type DomainPackVerificationRules = z.infer<typeof DomainPackVerificationRulesSchema>;
