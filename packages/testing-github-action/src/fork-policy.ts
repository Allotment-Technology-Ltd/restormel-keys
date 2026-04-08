/** How to treat pull requests from repository forks (secrets are not available to fork workflows by default). */
export type ForkPrPolicy = "skip" | "run";

/**
 * When policy is `skip` and the run is identified as a fork PR, the action should not execute the suite.
 */
export function shouldSkipForkPr(policy: ForkPrPolicy, isForkPr: boolean): boolean {
  return policy === "skip" && isForkPr;
}
