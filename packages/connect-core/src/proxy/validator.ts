/**
 * Verifying proxy — validator independence (D-c). (planning/w2-1-phase-a-reference-integration.md)
 *
 * The validator (the injected `ExtractionGenerate` used for quote retrieval and span-scoped
 * entailment) is RESTORMEL-SELECTED, never the upstream's. It MUST come from a different model
 * family than the (known) author of the answer being verified — a model cannot be trusted to
 * adjudicate its own output. When independence cannot be guaranteed we FAIL CLOSED: the verify
 * core still runs, but every claim it cannot independently judge routes to abstain/review
 * (judgeEntailment already fail-safe-abstains a generate that throws or returns nothing).
 *
 * This module is hermetic: it composes/selects validators and asserts independence. It holds no
 * keys and makes no network calls itself — the real provider leg is wired by the caller
 * (scripts/reviews/verifying-proxy-reference.ts) exactly like verifier-efficacy.ts.
 */
import type { ExtractionGenerate } from "../ingest/extract.js";
import type { AnswerAuthor } from "./types.js";

/** A Restormel-selected validator: its family/model and the generate function to call it. */
export type RestormelValidator = {
  family: string;
  model: string | null;
  generate: ExtractionGenerate;
};

export class ValidatorIndependenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidatorIndependenceError";
  }
}

/**
 * D-c: assert the validator family differs from the known answer author's family. Returns when
 * independent; throws ValidatorIndependenceError otherwise. When the author is unknown (null) we
 * cannot prove dependence — independence is assumed but flagged by the caller's policy; this
 * function does not block, because a Restormel-selected validator over an anonymous upstream is
 * the intended posture.
 */
export function assertValidatorIndependent(
  validatorFamily: string,
  author: AnswerAuthor,
): void {
  if (!author) return;
  if (validatorFamily.trim().toLowerCase() === author.family.trim().toLowerCase()) {
    throw new ValidatorIndependenceError(
      `validator family "${validatorFamily}" must differ from answer author family ` +
        `"${author.family}" (D-c: a model may not adjudicate its own output)`,
    );
  }
}

/**
 * A validator that always abstains — the fail-closed Restormel-side validator. Its generate
 * returns an empty body, which judgeEntailment treats as a coverage gap → abstain → review
 * (never a pass). Used when no real validator is available, or when independence fails and we
 * choose to keep verifying (every claim then abstains rather than silently passing).
 */
export function makeFailClosedValidator(
  reason = "no independent validator available",
): RestormelValidator {
  return {
    family: "restormel-fail-closed",
    model: `fail-closed:${reason}`,
    // Empty string ⇒ no parseable verdicts ⇒ judgeEntailment coverage-gap abstains (→ review).
    generate: async () => "",
  };
}

/**
 * A deterministic STUB validator for hermetic tests: it serves pre-baked entailment verdicts
 * keyed by claim text (or a wildcard "*"), so the verify core can be exercised end-to-end with
 * no keys and no network. The stub also answers the quote-retrieval prompt: when a fixtureQuotes
 * map is provided it returns those verbatim quotes; otherwise quote retrieval yields nothing
 * (claims must already carry upstream quotes to bind).
 *
 * Verdicts shape: { [claimText|"*"]: { verdict, confidence?, note? } }.
 */
export type StubVerdict = {
  verdict: "entailed" | "not_entailed" | "abstain";
  confidence?: number;
  note?: string;
};

export function makeStubValidator(args: {
  fixtureVerdicts: Record<string, StubVerdict>;
  /** Optional verbatim quotes the stub "retrieves" per claim text for binding. */
  fixtureQuotes?: Record<string, string[]>;
  family?: string;
  model?: string;
  /** When set, the stub throws on every call — exercises the validator-unreachable fail-safe. */
  throws?: boolean;
}): RestormelValidator {
  const generate: ExtractionGenerate = async ({ system, user }) => {
    if (args.throws) throw new Error("stub validator unreachable");

    // Quote-retrieval prompt (extract-claims.ts) — distinguished by its system preamble.
    if (/evidence retriever/i.test(system)) {
      return JSON.stringify({ results: serveQuotes(user, args.fixtureQuotes ?? {}) });
    }

    // Entailment prompt — echo a verdict per listed CLAIM ref.
    return JSON.stringify({ results: serveVerdicts(user, args.fixtureVerdicts) });
  };

  return { family: args.family ?? "restormel-stub", model: args.model ?? "stub-1", generate };
}

/** Map "CLAIM <ref>: <text>" lines in the prompt back to baked quotes. */
function serveQuotes(
  user: string,
  fixtureQuotes: Record<string, string[]>,
): { ref: string; quote: string }[] {
  const out: { ref: string; quote: string }[] = [];
  for (const { ref, claim } of parseClaimRefs(user)) {
    const quotes = fixtureQuotes[claim] ?? [];
    out.push({ ref, quote: quotes[0] ?? "" });
  }
  return out;
}

/** Map "CLAIM <ref>: <text>" lines in the prompt back to baked verdicts. */
function serveVerdicts(
  user: string,
  fixtureVerdicts: Record<string, StubVerdict>,
): { ref: string; verdict: string; confidence: number | null; note?: string }[] {
  const out: { ref: string; verdict: string; confidence: number | null; note?: string }[] = [];
  for (const { ref, claim } of parseClaimRefs(user)) {
    const v = fixtureVerdicts[claim] ?? fixtureVerdicts["*"];
    if (!v) continue; // omit ⇒ judgeEntailment coverage-gap abstains (fail-safe).
    out.push({
      ref,
      verdict: v.verdict,
      confidence: v.confidence ?? null,
      ...(v.note ? { note: v.note } : {}),
    });
  }
  return out;
}

/** Both prompts list claims as `CLAIM <ref>: <text>` — parse ref→claim back out. */
function parseClaimRefs(user: string): { ref: string; claim: string }[] {
  const out: { ref: string; claim: string }[] = [];
  const re = /CLAIM\s+(\S+):\s*(.+?)(?=\n\s*(?:EVIDENCE:|CLAIM\s+\S+:)|\n*$)/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(user)) !== null) {
    out.push({ ref: m[1]!.trim(), claim: m[2]!.trim() });
  }
  return out;
}
