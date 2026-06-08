/**
 * Restormel Core v1 — the built-in verification rule set (Stage 4C).
 *
 * This makes the previously-implicit six-dimension scoring explicit and inspectable. The weights
 * encoded here are the REAL weights the reasoning-eval pipeline uses
 * (`packages/reasoning-core/src/reasoning-eval.ts` `WEIGHTS`). Scores are on a 0–1 scale, matching
 * `ReasoningEvaluationSchema.overall_score`. The overall score is the weighted sum of the six
 * dimension scores; a policy then classifies that overall score as supported / weak / unsupported.
 *
 * The per-dimension comments explaining *why* each weight was chosen are the seed of the public
 * documentation (see ./README.md).
 */
import type { VerificationRuleSet } from "@restormel/contracts/verification-rules";

export const RESTORMEL_CORE_RULE_SET_ID = "restormel-core-v1";

export const RESTORMEL_CORE_RULE_SET: VerificationRuleSet = {
  id: RESTORMEL_CORE_RULE_SET_ID,
  name: "Restormel Core v1",
  version: "1.0.0",
  description:
    "The default verification rule set. Scores reasoning quality (not factual truth) across six " +
    "dimensions and classifies each claim as supported, weak, or unsupported.",
  dimensions: [
    {
      id: "logical_structure",
      name: "Logical structure",
      description:
        "Does the conclusion follow from the premises? Are the inferences valid and free of " +
        "fallacies (non-sequitur, affirming the consequent, circularity)?",
      // Highest weight: validity is the backbone of reasoning quality. A structurally invalid
      // argument fails regardless of how well-evidenced or well-scoped it is.
      weight: 0.25,
      prompt_template:
        "Assess whether the conclusion follows from the stated premises. Penalise formal and " +
        "informal fallacies, circular reasoning, and unsupported inferential leaps.",
      passing_threshold: 0.6,
    },
    {
      id: "evidence_grounding",
      name: "Evidence grounding",
      description:
        "Are the claims supported by cited evidence or sources rather than bare assertion?",
      // Grounding and counterargument coverage are the two strongest predictors of a claim
      // surviving external scrutiny, so they share the second-highest weight.
      weight: 0.2,
      prompt_template:
        "Assess whether each claim is backed by evidence present in the source text. Penalise " +
        "assertions presented without grounding.",
      passing_threshold: 0.6,
    },
    {
      id: "counterargument_coverage",
      name: "Counterargument coverage",
      description:
        "Does the argument engage the strongest opposing positions rather than ignoring them or " +
        "attacking strawmen?",
      weight: 0.2,
      prompt_template:
        "Assess whether the argument acknowledges and addresses the strongest objections. Penalise " +
        "omission of obvious counterarguments and strawman framing.",
      passing_threshold: 0.55,
    },
    {
      id: "scope_calibration",
      name: "Scope calibration",
      description:
        "Are claims scoped to what the evidence supports, rather than over-generalised " +
        "(e.g. 'always', 'never', 'all') beyond their warrant?",
      // Over-claiming is the most common reasoning defect; weighted moderately so it discriminates
      // without dominating structurally-sound arguments.
      weight: 0.15,
      prompt_template:
        "Assess whether claim scope matches the supporting evidence. Penalise universal claims " +
        "supported only by narrow evidence.",
      passing_threshold: 0.55,
    },
    {
      id: "assumption_transparency",
      name: "Assumption transparency",
      description:
        "Are background assumptions made explicit rather than smuggled in unstated?",
      // A hygiene check: important, but more binary and less discriminating than the above, so it
      // carries a lower weight.
      weight: 0.1,
      prompt_template:
        "Assess whether the argument's load-bearing assumptions are stated. Penalise hidden " +
        "premises that the conclusion depends on.",
      passing_threshold: 0.5,
    },
    {
      id: "internal_consistency",
      name: "Internal consistency",
      description: "Are the claims mutually consistent, with no self-contradiction?",
      // Also a hygiene check — typically high unless an argument actively contradicts itself —
      // so it shares the lowest weight.
      weight: 0.1,
      prompt_template:
        "Assess whether the claims are mutually consistent. Penalise direct contradictions between " +
        "claims in the same argument.",
      passing_threshold: 0.5,
    },
  ],
  policies: [
    {
      // Higher thresholds for regulated / high-stakes use cases where a false 'supported' is costly.
      id: "strict",
      name: "strict",
      min_overall_score: 0.75,
      weak_threshold: 0.6,
    },
    {
      // The current default — mirrors the production reasoning-eval behaviour.
      id: "balanced",
      name: "balanced",
      min_overall_score: 0.6,
      weak_threshold: 0.45,
    },
    {
      // Lower thresholds for exploratory ingestion of lower-quality sources, where recall matters
      // more than precision.
      id: "lenient",
      name: "lenient",
      min_overall_score: 0.45,
      weak_threshold: 0.3,
    },
  ],
  domain_hints: ["philosophy", "general"],
};
