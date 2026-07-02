/**
 * Frontier-API escalation tier (REC-GOV-022 recommended set: "frontier verification APIs",
 * D-2026-07-02-1 scope). Cascade stage 3 — the hardest residual only
 * (restormel-verification-engineering §4; §5 LLM-judge tiers: judges are the escalation
 * tier, not the default).
 *
 * This tier is REAL integration code: it drives an injected `generate` function
 * (the connect-core `ExtractionGenerate` shape already used by ingest/entailment.ts and the
 * verifying proxy). The HOST APP binds `generate` to a frontier route resolved through Keys
 * routing — a real, credentialed call. connect-core never reads process.env and never
 * imports a vendor SDK (plugpoints credential + no-vendor-import rules).
 *
 * HONESTY (skill §HONESTY): a live frontier call needs an API credential (e.g. via the Keys
 * route), which is NOT available in this environment. So:
 *   - The live path is exercised by the harness ONLY when a real `generate` is injected;
 *     otherwise the harness injects `frontierFixtureGenerate` (a deterministic double) and
 *     the emitted span is `fixture: true`.
 *   - §5 judge-bias mitigations are honoured: the judge prompt is a FROZEN, VERSIONED
 *     artifact (FRONTIER_JUDGE_PROMPT_VERSION, folded into the cache key), and the tier's
 *     modelFamily is asserted independent of the content author by the cascade.
 *
 * Defensive JSON parsing mirrors ingest/entailment.ts: an unparseable response THROWS
 * VerifierParseError (-> cascade abstains), never a silent pass.
 */
import type { VerifierRequest, VerifierResult, VerifierTier } from "../verifier-port.js";
import { verdictFromEntailment, VerifierParseError } from "../verdict.js";

/** Frozen, versioned judge prompt (skill §5). Any wording change bumps this + re-calibrates. */
export const FRONTIER_JUDGE_PROMPT_VERSION = "frontier-judge-1";

/** Minimal generate signature — matches connect-core's ExtractionGenerate (no vendor types). */
export type FrontierGenerate = (input: { system: string; user: string }) => Promise<string>;

export function buildFrontierJudgeSystemPrompt(): string {
  return (
    `You are a strict, length-controlled entailment judge. Given ONE claim and its ONE ` +
    `verbatim evidence span, decide only whether the span entails the claim. Use no outside ` +
    `knowledge; the span is the entire universe of evidence. Score length-controlled — a ` +
    `longer span is not more convincing. Return STRICT JSON only:\n` +
    `{ "verdict": "supported|contradicted|unverifiable", "confidence": <0-1>, "note": "<short>" }\n` +
    `"contradicted" = the span refutes the claim; "unverifiable" = the span is silent; ` +
    `"supported" = the span states or fairly paraphrases the claim.`
  );
}

export function buildFrontierJudgeUserPrompt(request: VerifierRequest): string {
  const ctx = request.context ? `\nCONTEXT: ${request.context}` : "";
  return `CLAIM: ${request.claim}\nSPAN: "${request.span}"${ctx}`;
}

/** Defensive parse (entailment.ts idiom): loose JSON, per-field typeof narrowing, throw on fail. */
export function parseFrontierResponse(tierId: string, raw: string): VerifierResult {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s < 0 || e <= s) throw new VerifierParseError(tierId, "no JSON object in response");
    try {
      obj = JSON.parse(raw.slice(s, e + 1));
    } catch {
      throw new VerifierParseError(tierId, "malformed JSON object");
    }
  }
  const rec = (obj ?? {}) as Record<string, unknown>;
  const v = typeof rec.verdict === "string" ? rec.verdict.trim() : "";
  // Map the frontier's vocabulary to Verdict WITHOUT ever defaulting to "supported".
  let verdict: VerifierResult["verdict"];
  if (v === "supported") verdict = "supported";
  else if (v === "contradicted") verdict = "contradicted";
  else if (v === "unverifiable") verdict = "unverifiable";
  else throw new VerifierParseError(tierId, `unrecognized verdict "${v.slice(0, 40)}"`);
  const confidence =
    typeof rec.confidence === "number" && Number.isFinite(rec.confidence)
      ? Math.min(1, Math.max(0, rec.confidence))
      : null;
  return {
    ref: "",
    verdict,
    confidence,
    ...(typeof rec.note === "string" && rec.note.trim() ? { note: rec.note.trim() } : {}),
  };
}

export interface FrontierTierOptions {
  /** Injected generate. Host app binds a real frontier route; tests/harness inject a double. */
  generate: FrontierGenerate;
  /** Model family of the frontier model (for the independence check), e.g. "anthropic". */
  modelFamily: string;
  /** Model id/version string, folded into the cache key. */
  modelVersion: string;
}

export function createFrontierEscalationTier(opts: FrontierTierOptions): VerifierTier {
  const tierId = "frontier-api";
  return {
    id: tierId,
    modelFamily: opts.modelFamily,
    modelVersion: opts.modelVersion,
    // Judge prompt version is the DISTINCT key input (skill §6 + §5 "frozen, versioned
    // prompts"); configHash covers any non-prompt call params (none for this double).
    configHash: "double",
    promptTemplateVersion: FRONTIER_JUDGE_PROMPT_VERSION,
    async verify(request: VerifierRequest): Promise<VerifierResult> {
      const system = buildFrontierJudgeSystemPrompt();
      const user = buildFrontierJudgeUserPrompt(request);
      // A thrown error here (network/parse) propagates to the cascade tier boundary, which
      // resolves the claim to "abstained" — never a pass. No verdict-valued catch here.
      const raw = await opts.generate({ system, user });
      const parsed = parseFrontierResponse(tierId, raw);
      return { ...parsed, ref: request.ref };
    },
  };
}

/**
 * Deterministic FIXTURE double for the frontier `generate` — used when no credentialed
 * route is available (this environment). It reasons over the same lexical signal as the
 * other doubles and emits valid frontier JSON, so the parse + tier path is exercised for
 * real while being HONESTLY a fixture (the harness marks the span `fixture: true`).
 */
export const frontierFixtureGenerate: FrontierGenerate = async ({ user }) => {
  const claimMatch = user.match(/CLAIM: (.*)/);
  const spanMatch = user.match(/SPAN: "([\s\S]*?)"/);
  const claim = (claimMatch?.[1] ?? "").toLowerCase();
  const span = (spanMatch?.[1] ?? "").toLowerCase();
  const claimTokens = claim.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2);
  const spanSet = new Set(span.replace(/[^a-z0-9\s]/g, " ").split(/\s+/));
  const present = claimTokens.filter((t) => spanSet.has(t)).length;
  const overlap = claimTokens.length ? present / claimTokens.length : 0;
  const negRe = /\b(not|never|no|false|cannot|none|neither|nor|without)\b/;
  // Explicit span negation OR a claim/span polarity flip over shared content -> contradicted.
  const polarityFlip = overlap >= 0.4 && negRe.test(claim) !== negRe.test(span);
  if ((negRe.test(span) && overlap >= 0.4) || polarityFlip) {
    return JSON.stringify({ verdict: "contradicted", confidence: 0.8, note: "fixture: refutation" });
  }
  if (overlap >= 0.5) {
    return JSON.stringify({ verdict: "supported", confidence: 0.75 + overlap * 0.2, note: "fixture" });
  }
  return JSON.stringify({ verdict: "unverifiable", confidence: 0.7, note: "fixture: span silent" });
};
