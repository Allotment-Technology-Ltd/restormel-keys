import type { Verdict } from "@restormel/testing-core";

export type AttemptOutcome =
  | { kind: "stop"; verdict: "passed"; reasonCode: string; summary: string }
  | { kind: "stop"; verdict: "indeterminate"; reasonCode: string; summary: string }
  | { kind: "stop"; verdict: "failed"; reasonCode: string; summary: string; retryable: false }
  | { kind: "retry"; verdict: "failed"; reasonCode: string; summary: string; retryable: true };

/**
 * `maxRetries` = extra attempts after the first (e.g. 2 → 3 total tries).
 */
export async function runGoalAttempts(options: {
  maxRetries: number;
  backoffMs?: number;
  runAttempt: (attemptIndex: number) => Promise<AttemptOutcome>;
}): Promise<{ verdict: Verdict; reasonCode: string; summary: string; retriesUsed: number }> {
  const maxAttempts = Math.max(1, options.maxRetries + 1);
  let lastFail: { reasonCode: string; summary: string } | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0 && options.backoffMs !== undefined && options.backoffMs > 0) {
      await sleep(options.backoffMs);
    }

    const out = await options.runAttempt(attempt);
    if (out.kind === "stop") {
      return {
        verdict: out.verdict,
        reasonCode: out.reasonCode,
        summary: out.summary,
        retriesUsed: attempt,
      };
    }

    lastFail = { reasonCode: out.reasonCode, summary: out.summary };
    if (!out.retryable || attempt === maxAttempts - 1) {
      return {
        verdict: "failed",
        reasonCode: out.reasonCode,
        summary: out.summary,
        retriesUsed: attempt,
      };
    }
  }

  return {
    verdict: "failed",
    reasonCode: lastFail?.reasonCode ?? "UNKNOWN",
    summary: lastFail?.summary ?? "Goal failed",
    retriesUsed: maxAttempts - 1,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
