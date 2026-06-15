/**
 * Verifying proxy — verifyEnvelope() façade. (planning/w2-1-phase-a-reference-integration.md)
 *
 * Hermetic core: given a Mode-1 result and a Restormel-selected validator, produce a
 * VerifiedEnvelope by reusing the EBV engine — NO MCP, NO keys, NO network here.
 *
 * Per claim:
 *   1. retrieve a candidate verbatim quote per cited source (upstream quote, else validator);
 *   2. contentHash each cited source and bindEvidenceSpan({quote, sourceText, sourceHash})
 *      deterministically (Layer 1) — keep the best binding across the claim's cited sources;
 *   3. judgeEntailment over the bound span (Layer 2, cross-model);
 *   4. compose EnvelopeClaim under the FAIL-SAFE status table.
 *
 * Status table (load-bearing — see types.ts):
 *   bound + entailed       → supported
 *   bound + not_entailed   → unverified
 *   ANYTHING else          → abstain (→ review)
 * An error, timeout, or missing verdict is NEVER supported. The upstream callTool leg lives in
 * packages/mcp; this façade measures the legs it owns (retrieval / entailment / layer-1) and the
 * caller folds in callTool latency.
 */
import { contentHash, bindEvidenceSpan, type EvidenceBinding } from "../ingest/evidence-binding.js";
import { judgeEntailment, type EntailmentInput, type UnitEntailment } from "../ingest/entailment.js";
import { ENTAILMENT_LOW_CONFIDENCE } from "../ingest/entailment.js";
import type { ExtractionGenerate } from "../ingest/extract.js";
import { parseMode1Result, retrieveQuotes } from "./extract-claims.js";
import { assertValidatorIndependent, makeFailClosedValidator, type RestormelValidator } from "./validator.js";
import type {
  AnswerAuthor,
  EnvelopeClaim,
  EnvelopeStatus,
  Mode1Result,
  Mode1Source,
  VerifiedEnvelope,
} from "./types.js";

/** Default per-claim verification budget (validator may hang / be unreachable). */
const DEFAULT_VALIDATOR_TIMEOUT_MS = 30_000;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Cost counter wrapper around the injected validator (Restormel-side spend only). */
function withCost(
  gen: ExtractionGenerate,
  cost: { calls: number; chars: number },
): ExtractionGenerate {
  return async (input) => {
    cost.calls += 1;
    cost.chars += input.system.length + input.user.length;
    const out = await gen(input);
    cost.chars += out.length;
    return out;
  };
}

/** Race a validator call against a timeout; a timeout surfaces as a thrown error (→ abstain). */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Apply the fail-safe status table. The ONLY path to "supported" is a bound span whose
 * entailment verdict is "entailed" with confidence at or above the low-confidence floor.
 * Everything else routes to unverified (bound + not_entailed) or abstain (all else).
 */
export function deriveEnvelopeStatus(
  binding: EvidenceBinding,
  entailment: { verdict: "entailed" | "not_entailed" | "abstain"; confidence: number | null },
): EnvelopeStatus {
  if (binding.status !== "bound") return "abstain";
  if (entailment.verdict === "entailed") {
    // Low-confidence "entailed" routes to review, never supported (inherits EBV semantics).
    if (entailment.confidence !== null && entailment.confidence < ENTAILMENT_LOW_CONFIDENCE) {
      return "abstain";
    }
    return "supported";
  }
  if (entailment.verdict === "not_entailed") return "unverified";
  return "abstain";
}

export type VerifyEnvelopeArgs = {
  result: Mode1Result;
  /** Restormel-selected validator (the injected EBV judge / quote-retriever). */
  validator: RestormelValidator;
  /** Known author of the Mode-1 answer, for the D-c independence assertion (null = unknown). */
  author?: AnswerAuthor;
  /** k-sample self-consistency for entailment (defaults to 1). */
  kSamples?: number;
  /** Per-validator-call timeout (ms). */
  validatorTimeoutMs?: number;
};

/**
 * Verify a Mode-1 result into a VerifiedEnvelope. Fails CLOSED: if validator independence cannot
 * be guaranteed (D-c) we swap in a Restormel-side fail-closed validator (every claim abstains →
 * review) rather than trusting a same-family judge. Never throws on validator faults — they
 * become abstentions.
 */
export async function verifyEnvelope(args: VerifyEnvelopeArgs): Promise<VerifiedEnvelope> {
  const timeoutMs = args.validatorTimeoutMs ?? DEFAULT_VALIDATOR_TIMEOUT_MS;
  const cost = { calls: 0, chars: 0 };
  const legs_ms: Record<string, number> = { quote_retrieval: 0, judge_entailment: 0, layer1_bind: 0 };

  // D-c: fail closed to a Restormel-side validator if independence cannot be guaranteed.
  let validator = args.validator;
  try {
    assertValidatorIndependent(validator.family, args.author ?? null);
  } catch {
    validator = makeFailClosedValidator(
      `validator family "${args.validator.family}" not independent of answer author`,
    );
  }

  const claims = parseMode1Result(args.result);
  // Each validator call is wrapped: cost counted + timeout enforced (timeout ⇒ throws ⇒ abstain).
  const countedGenerate: ExtractionGenerate = withCost(
    (input) => withTimeout(validator.generate(input), timeoutMs, "validator"),
    cost,
  );

  // ── Leg (b): quote retrieval (0 validator calls when the upstream supplied quotes). ──
  const tRetrieval = now();
  let quotes: Map<string, string>;
  try {
    quotes = await retrieveQuotes({ claims, generate: countedGenerate });
  } catch {
    quotes = new Map(); // validator-unreachable → empty quotes → unbound → abstain.
  }
  legs_ms.quote_retrieval = Math.round(now() - tRetrieval);

  // ── Leg (d): Layer-1 bind + hash (deterministic, ~free). Best binding across cited sources. ──
  const tBind = now();
  const sourceHashes = new Map<string, string>();
  const perClaim: {
    claim: string;
    binding: EvidenceBinding;
    source_ref: { id: string; uri?: string; source_hash: string };
    quote: string;
  }[] = [];

  for (let i = 0; i < claims.length; i++) {
    const cw = claims[i]!;
    let best:
      | { binding: EvidenceBinding; source: Mode1Source; sourceHash: string; quote: string }
      | null = null;

    for (const source of cw.sources) {
      let sourceHash = sourceHashes.get(source.id);
      if (sourceHash === undefined) {
        sourceHash = await contentHash(source.text);
        sourceHashes.set(source.id, sourceHash);
      }
      const quote = quotes.get(`${i}::${source.id}`) ?? "";
      const binding = bindEvidenceSpan({ quote, sourceText: source.text, sourceHash });
      // Prefer a bound span; among bound, prefer the strictest match (exact > normalized > fuzzy).
      if (isBetterBinding(binding, best?.binding ?? null)) {
        best = { binding, source, sourceHash, quote };
      }
    }

    if (best) {
      perClaim.push({
        claim: cw.claim,
        binding: best.binding,
        source_ref: {
          id: best.source.id,
          ...(best.source.uri ? { uri: best.source.uri } : {}),
          source_hash: best.sourceHash,
        },
        quote: best.quote,
      });
    } else {
      // No cited source at all → nothing to bind → abstain. Hash empty string as the null ref.
      perClaim.push({
        claim: cw.claim,
        binding: { status: "no_evidence", reason: "extractor_returned_no_quote" },
        source_ref: { id: "(none)", source_hash: await contentHash("") },
        quote: "",
      });
    }
  }
  legs_ms.layer1_bind = Math.round(now() - tBind);

  // ── Leg (c): span-scoped entailment (Layer 2). Claims with no bound span never reach the
  //    judge — judgeEntailment abstains them locally with no_bound_evidence (fail-safe). ──
  const entailmentInputs: EntailmentInput[] = perClaim.map((pc, i) => ({
    ref: `e${i}`,
    claim: pc.claim,
    spans: pc.binding.status === "bound" ? [pc.binding.span.quote] : [],
  }));

  const tJudge = now();
  let entailmentResults: UnitEntailment[] = [];
  let validatorModel: string | null = validator.model;
  try {
    const judged = await judgeEntailment({
      inputs: entailmentInputs,
      generate: countedGenerate,
      ...(args.kSamples ? { kSamples: args.kSamples } : {}),
      modelId: validator.model,
    });
    entailmentResults = judged.results;
    validatorModel = judged.meta.model_id;
  } catch {
    // judgeEntailment itself failing is a total coverage gap → all claims abstain.
    entailmentResults = [];
  }
  legs_ms.judge_entailment = Math.round(now() - tJudge);

  const byRef = new Map(entailmentResults.map((r) => [r.ref, r]));

  const envelopeClaims: EnvelopeClaim[] = perClaim.map((pc, i) => {
    const judged = byRef.get(`e${i}`);
    // Missing verdict ⇒ fail-safe abstain (NEVER a silent pass).
    const entailment = judged
      ? { verdict: judged.verdict, confidence: judged.confidence, ...(judged.note ? { note: judged.note } : {}) }
      : { verdict: "abstain" as const, confidence: null, note: "coverage_gap: no verdict returned" };
    const status = deriveEnvelopeStatus(pc.binding, entailment);
    return {
      claim: pc.claim,
      status,
      binding: pc.binding,
      entailment,
      source_ref: pc.source_ref,
    };
  });

  return {
    claims: envelopeClaims,
    meta: {
      validator_model: validatorModel,
      judged_at: new Date().toISOString(),
      legs_ms,
      restormel_cost: cost,
    },
  };
}

const MATCH_RANK: Record<string, number> = { exact: 3, normalized: 2, fuzzy: 1 };

/** A bound span beats anything unbound; among bound, a stricter match wins. */
function isBetterBinding(candidate: EvidenceBinding, current: EvidenceBinding | null): boolean {
  if (!current) return true;
  if (candidate.status === "bound" && current.status !== "bound") return true;
  if (candidate.status === "bound" && current.status === "bound") {
    return (MATCH_RANK[candidate.span.match] ?? 0) > (MATCH_RANK[current.span.match] ?? 0);
  }
  return false;
}
