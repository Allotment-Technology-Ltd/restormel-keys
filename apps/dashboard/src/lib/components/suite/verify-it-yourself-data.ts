/**
 * Illustrative data for the homepage "Don't trust it. Check it." centerpiece
 * (VerifyItYourself.svelte). NOT live data — a hand-authored regulated example
 * that demonstrates the verified-context contract:
 *
 *  - a `supported` claim is bound to a verbatim quote span in a source, with a
 *    re-checkable trace ref (ledger rows #2, #7, #9);
 *  - an `unsupported` claim has no source span, so it is excluded and never
 *    shown to the agent (ledger rows #1, #4).
 *
 * The source span offsets are real offsets into `source.body` so the
 * highlight is computed, not hard-coded — mirroring how a bound evidence span
 * carries quote + offsets + source hash.
 */

export interface VerifySource {
  /** Short label shown on the source panel chrome (e.g. document id). */
  id: string;
  /** Human title of the source document. */
  title: string;
  /** The full source text the claims are checked against. */
  body: string;
}

export type VerifyState = "supported" | "unsupported";

export interface VerifyClaim {
  id: string;
  /** The sentence the agent asserted in its answer. */
  text: string;
  state: VerifyState;
  /**
   * For `supported`: [start, end] character offsets into `source.body` of the
   * bound verbatim quote. For `unsupported`: null (no span exists).
   */
  span: [number, number] | null;
  /** One-line verification verdict shown when the claim is selected. */
  verdict: string;
  /** Illustrative trace reference (only meaningful for supported claims). */
  traceRef: string | null;
}

export interface VerifyScenario {
  /** The user's question the agent is answering. */
  question: string;
  source: VerifySource;
  claims: VerifyClaim[];
}

/**
 * Compliance "Policy 7.2" example. The quote offsets below are computed against
 * `SOURCE_BODY` at module load so they cannot drift out of sync with the text.
 */
const SOURCE_BODY = [
  "7.2 Data Retention.",
  "",
  "Customer records containing personal data MUST be retained for a minimum of six (6) years from the date of the last transaction, after which they are subject to scheduled deletion. Records under an active legal hold are exempt from scheduled deletion until the hold is formally released by the Data Protection Officer.",
].join("\n");

/** Verbatim quote the supported claim is bound to. */
const SUPPORTED_QUOTE = "retained for a minimum of six (6) years from the date of the last transaction";

function spanOf(body: string, quote: string): [number, number] {
  const start = body.indexOf(quote);
  if (start === -1) {
    throw new Error("verify-it-yourself: supported quote not found in source body");
  }
  return [start, start + quote.length];
}

export const VERIFY_SCENARIO: VerifyScenario = {
  question: "How long must we keep customer records under Policy 7.2?",
  source: {
    id: "POLICY-7.2",
    title: "Data Retention Policy — §7.2",
    body: SOURCE_BODY,
  },
  claims: [
    {
      id: "claim-retention",
      text: "Customer records must be retained for at least six years from the last transaction.",
      state: "supported",
      span: spanOf(SOURCE_BODY, SUPPORTED_QUOTE),
      verdict: "Bound to a verbatim quote, re-checkable at read time.",
      traceRef: "trace:rstrml:8f31c2",
    },
    {
      id: "claim-legalhold",
      text: "Records on legal hold are auto-deleted after seven years.",
      state: "unsupported",
      span: null,
      verdict: "No source span — excluded, never shown to the agent.",
      traceRef: null,
    },
  ],
};
