/**
 * Cascade verdict schema and named error taxonomy (REC-ADR-023 §3, REC-PLAN-023;
 * restormel-verification-engineering §4 — cascade design and abstention).
 *
 * This is the *proposed* four-value verdict union the verification-engineering skill
 * names (§4): it supersedes, and is deliberately distinct from, the shipped
 * `EntailmentVerdict` union ("entailed" | "not_entailed" | "abstain",
 * ingest/entailment.ts). The migration mapping (skill §4) is:
 *   entailed      -> "supported"
 *   not_entailed  -> split into "contradicted" (span refutes the claim) vs
 *                    "unverifiable" (span is silent — insufficient for THIS claim+span)
 *   abstain       -> "abstained" (cascade exhausted -> routed to human)
 * Existing EntailmentVerdict code is NOT a violation; mixing the two vocabularies in one
 * module IS. The cascade lives in its own module set and speaks only Verdict; the bridge
 * from a tier that internally reasons in entailment terms is `verdictFromEntailment()`.
 *
 * Adding a variant here is an ADR-level change. Mapping an error, timeout, or budget
 * exhaustion to "supported" is a Blocker (skill §4): failures surface as the named error
 * classes below, or resolve to "abstained" — never a silent pass.
 *
 * No node:crypto and no DB/Surreal deps — connect-core stays MIT (skill §Workflow step 3).
 */

/**
 * The closed cascade verdict union (skill §4, checkable by the type system).
 *  - "supported":     the bound span entails the claim.
 *  - "contradicted":  the bound span refutes the claim.
 *  - "unverifiable":  evidence insufficient for THIS claim+span (span silent / no binding).
 *  - "abstained":     the cascade exhausted its tiers -> routed to human review.
 */
export type Verdict = "supported" | "contradicted" | "unverifiable" | "abstained";

export const VERDICTS: readonly Verdict[] = [
  "supported",
  "contradicted",
  "unverifiable",
  "abstained",
] as const;

export function isVerdict(v: unknown): v is Verdict {
  return typeof v === "string" && (VERDICTS as readonly string[]).includes(v);
}

/**
 * Bridge from the shipped entailment vocabulary to the cascade Verdict, WITHOUT mixing the
 * two unions inside a single reasoning module. A tier double that thinks in entailment
 * terms produces `{verdict, confidence}` and passes it here to speak Verdict outward.
 *
 * "not_entailed" is resolved conservatively: only an explicit refutation signal maps to
 * "contradicted"; the default is "unverifiable" (the span is silent on the claim). This is
 * the safe direction — we never manufacture a contradiction we did not observe.
 */
export function verdictFromEntailment(
  verdict: "entailed" | "not_entailed" | "abstain",
  opts?: { refuted?: boolean },
): Verdict {
  switch (verdict) {
    case "entailed":
      return "supported";
    case "not_entailed":
      return opts?.refuted ? "contradicted" : "unverifiable";
    case "abstain":
      return "abstained";
  }
}

/** True for verdicts that decide a claim; "abstained" is a non-decision routed to a human. */
export function isDecisiveVerdict(v: Verdict): boolean {
  return v === "supported" || v === "contradicted";
}

/**
 * Base class for every cascade failure. Failures are represented as thrown, named errors
 * with a stable `code` — the cascade orchestrator catches them at the tier boundary and
 * resolves the claim to "abstained" (never "supported"). This keeps the anti-pattern
 * "try/catch that returns a pass" structurally impossible: there is no verdict-valued
 * catch anywhere in the tier-call path.
 */
export class CascadeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CascadeError";
    this.code = code;
  }
}

/** A tier's model call did not return within its budget. */
export class VerifierTimeoutError extends CascadeError {
  readonly tierId: string;
  readonly timeoutMs: number;
  constructor(tierId: string, timeoutMs: number) {
    super("verifier_timeout", `tier "${tierId}" timed out after ${timeoutMs}ms`);
    this.name = "VerifierTimeoutError";
    this.tierId = tierId;
    this.timeoutMs = timeoutMs;
  }
}

/** A tier returned a response that could not be parsed into a verdict. */
export class VerifierParseError extends CascadeError {
  readonly tierId: string;
  constructor(tierId: string, detail: string) {
    super("verifier_parse_error", `tier "${tierId}" produced an unparseable verdict: ${detail}`);
    this.name = "VerifierParseError";
    this.tierId = tierId;
  }
}

/** The per-request latency budget (door 2) was exhausted before the cascade concluded. */
export class BudgetExhaustedError extends CascadeError {
  readonly spentMs: number;
  readonly budgetMs: number;
  constructor(spentMs: number, budgetMs: number) {
    super("budget_exhausted", `latency budget exhausted: spent ${spentMs}ms of ${budgetMs}ms`);
    this.name = "BudgetExhaustedError";
    this.spentMs = spentMs;
    this.budgetMs = budgetMs;
  }
}

/**
 * Two adjacent tiers, or a tier and the content author, share a model family — a spine
 * invariant breach (REC-ADR-023 invariant 1; skill §4 cross-model independence). Thrown at
 * cascade construction, not per claim: an independence breach is a configuration bug.
 */
export class ModelIndependenceError extends CascadeError {
  constructor(message: string) {
    super("model_independence", message);
    this.name = "ModelIndependenceError";
  }
}

/** A component id in the BLOCKED/AMBIGUOUS set reached the cascade (defence in depth). */
export class BlockedComponentError extends CascadeError {
  constructor(componentId: string) {
    super("blocked_component", `component "${componentId}" is BLOCKED/AMBIGUOUS (REC-GOV-022)`);
    this.name = "BlockedComponentError";
  }
}
