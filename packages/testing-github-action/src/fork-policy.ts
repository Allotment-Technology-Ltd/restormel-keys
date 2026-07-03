/** How to treat pull requests from repository forks (secrets are not available to fork workflows by default). */
export type ForkPrPolicy = "skip" | "run" | "require_label" | "sandbox_only";

export type ForkPrSkipReason = "fork_default" | "fork_missing_label";

export interface ForkPrEvaluationContext {
  isForkPr: boolean;
  /**
   * When using `require_label` or `sandbox_only`, the workflow should pass `true` if the PR has the
   * maintainer-approved label (e.g. `contains(github.event.pull_request.labels.*.name, 'ok-to-test')`).
   */
  requiredLabelPresent: boolean;
}

export interface ForkPrEvaluationResult {
  /** When false, the action should not invoke the runner. */
  execute: boolean;
  skipReason?: ForkPrSkipReason;
  /**
   * When skipping, exit **78** so required checks can be configured as “neutral” in some setups.
   * `skip` and `require_label` use exit **0** on skip (green step).
   */
  useNeutralExit: boolean;
}

/**
 * Decide whether fork PRs should run, and whether a neutral exit code is appropriate.
 */
export function evaluateForkPrPolicy(policy: ForkPrPolicy, ctx: ForkPrEvaluationContext): ForkPrEvaluationResult {
  if (!ctx.isForkPr) {
    return { execute: true, useNeutralExit: false };
  }
  if (policy === "run") {
    return { execute: true, useNeutralExit: false };
  }
  if (policy === "skip") {
    return { execute: false, skipReason: "fork_default", useNeutralExit: false };
  }
  if (ctx.requiredLabelPresent) {
    return { execute: true, useNeutralExit: false };
  }
  return {
    execute: false,
    skipReason: "fork_missing_label",
    useNeutralExit: policy === "sandbox_only",
  };
}

/** @deprecated Use {@link evaluateForkPrPolicy} with {@link ForkPrEvaluationContext}. */
export function shouldSkipForkPr(policy: "skip" | "run", isForkPr: boolean): boolean {
  return !evaluateForkPrPolicy(policy === "run" ? "run" : "skip", {
    isForkPr,
    requiredLabelPresent: false,
  }).execute;
}
