/**
 * EBV Layer 2 — span-scoped entailment with abstention.
 * (docs/decisions/evidence-bound-verification.md, approved 2026-06-09; Stage 1.0d)
 *
 * Replaces prefix-batch validation as the probabilistic layer: per claim, the judge is
 * asked "does THIS bound span entail THIS claim?" — the claim plus its 1–3 bound
 * evidence spans, never a 12k source prefix. The judge MAY abstain; abstention and low
 * confidence route to the review queue (never laundered into a remediation verdict).
 *
 * Fail-safe coverage (PR #189 semantics preserved): an omitted or unparseable verdict
 * is a coverage gap recorded as `abstain`, never a pass.
 *
 * Claims with no bound span are never sent to the judge — without evidence in the cited
 * source there is nothing to entail; they are `abstain`ed locally with reason
 * `no_bound_evidence` (the ADR's "no bindable evidence → unverified → review").
 *
 * k-sample self-consistency (high-stakes packs / preset flag): the same batch is judged
 * k times; a strict-majority verdict wins, disagreement becomes `abstain`.
 *
 * Cross-model routing is unchanged: callers bind `generate` to the validation-stage
 * route exactly as for the legacy validator (judge family ≠ extractor family).
 */
import type { ExtractionGenerate } from "./extract.js";
import {
  askBatchWithCoverageRetry,
  type CoverageShortfallHandler,
  type ParsedBatchResponse,
} from "./batch-coverage.js";

/** Bump when the system/user prompt wording changes — recorded with every verdict. */
export const ENTAILMENT_PROMPT_VERSION = 1;

/** Entailed verdicts below this confidence are routed to review, not supported. */
export const ENTAILMENT_LOW_CONFIDENCE = 0.5;

export type EntailmentVerdict = "entailed" | "not_entailed" | "abstain";

export type EntailmentInput = {
  ref: string;
  /** The claim text as stored (post-extraction, or post-repair on re-judge). */
  claim: string;
  /** Bound evidence quotes from the CITED source version (1–3). Empty = not judgeable. */
  spans: string[];
};

export type UnitEntailment = {
  ref: string;
  verdict: EntailmentVerdict;
  /** Judge-reported confidence 0–1; null when the judge omitted it. */
  confidence: number | null;
  note?: string;
};

/** Attribution recorded with every verdict so it is re-runnable and auditable. */
export type EntailmentJudgeMeta = {
  /** Model identifier when the caller knows it (route-resolved); null otherwise. */
  model_id: string | null;
  prompt_version: number;
  /** ISO 8601 time the batch was judged. */
  judged_at: string;
  /** Samples taken per claim (k-sample self-consistency). */
  samples: number;
};

export const ENTAILMENT_BATCH_SIZE = 10;

function readEntailmentBatchSize(): number {
  const raw = Number(process.env.CONNECT_ENTAILMENT_BATCH_SIZE ?? ENTAILMENT_BATCH_SIZE);
  if (!Number.isFinite(raw)) return ENTAILMENT_BATCH_SIZE;
  return Math.min(Math.max(Math.floor(raw), 1), 25);
}

export function buildEntailmentSystemPrompt(): string {
  return (
    `You are a strict entailment checker. For each claim you are given the exact quoted ` +
    `evidence span(s) from its cited source — and NOTHING else. Judge only whether the ` +
    `quoted span(s) entail the claim:\n` +
    `- "entailed": the span(s) state or directly support the claim (fair paraphrase counts)\n` +
    `- "not_entailed": the span(s) do not support the claim, or the claim overstates them\n` +
    `- "abstain": you cannot decide from the span(s) alone\n` +
    `Never use outside knowledge; the span is the entire universe of evidence. ` +
    `If a claim says more than its span, that is "not_entailed". When unsure, abstain — ` +
    `abstaining routes the claim to human review and is always safer than guessing.\n\n` +
    `Return STRICT JSON only:\n` +
    `{ "results": [{ "ref": "<ref>", "verdict": "entailed|not_entailed|abstain", ` +
    `"confidence": <0-1>, "note": "<short reason or omit>" }] }\n` +
    `Include one result for every listed ref — do not omit claims.`
  );
}

export function buildEntailmentUserPrompt(inputs: EntailmentInput[]): string {
  return inputs
    .map((input) => {
      const spans = input.spans
        .slice(0, 3)
        .map((s, i) => `  span ${i + 1}: "${s}"`)
        .join("\n");
      return `CLAIM ${input.ref}: ${input.claim}\nEVIDENCE:\n${spans}`;
    })
    .join("\n\n");
}

/**
 * Per-passage batching: claims sharing a span set sit in the same call where possible
 * (sorted by first span so shared passages cluster), then chunked to the batch size.
 * Short refs (e1, e2, …) per batch so the judge echoes ids reliably.
 */
export function buildEntailmentBatchInputs(
  inputs: EntailmentInput[],
): { batchInputs: EntailmentInput[]; refToUnitId: Map<string, string> }[] {
  const batchSize = readEntailmentBatchSize();
  const sorted = [...inputs].sort((a, b) =>
    (a.spans[0] ?? "").localeCompare(b.spans[0] ?? ""),
  );
  const batches: { batchInputs: EntailmentInput[]; refToUnitId: Map<string, string> }[] = [];
  for (let offset = 0; offset < sorted.length; offset += batchSize) {
    const slice = sorted.slice(offset, offset + batchSize);
    const refToUnitId = new Map<string, string>();
    const batchInputs = slice.map((input, index) => {
      const shortRef = `e${index + 1}`;
      refToUnitId.set(shortRef, input.ref);
      return { ...input, ref: shortRef };
    });
    batches.push({ batchInputs, refToUnitId });
  }
  return batches;
}

export function remapEntailmentBatchResults(
  results: UnitEntailment[],
  refToUnitId: Map<string, string>,
): UnitEntailment[] {
  const out: UnitEntailment[] = [];
  for (const result of results) {
    const unitId = refToUnitId.get(result.ref) ?? result.ref;
    if (!unitId) continue;
    out.push({ ...result, ref: unitId });
  }
  return out;
}

/**
 * Fail-safe coverage finalize (PR #189 semantics): a claim the judge never returned a
 * verdict for is a coverage gap — recorded as `abstain` (→ review), never a pass.
 */
export function finalizeEntailmentCoverage(
  inputs: EntailmentInput[],
  results: UnitEntailment[],
): UnitEntailment[] {
  const byRef = new Map<string, UnitEntailment>();
  for (const result of results) {
    if (!byRef.has(result.ref)) byRef.set(result.ref, result);
  }
  for (const input of inputs) {
    if (byRef.has(input.ref)) continue;
    byRef.set(input.ref, {
      ref: input.ref,
      verdict: "abstain",
      confidence: null,
      note: "coverage_gap: judge omitted this claim",
    });
  }
  return inputs.map((input) => byRef.get(input.ref)!);
}

/**
 * H1: loose-JSON parse with an explicit failure signal. `parseFailed` is true when the
 * response could not be parsed as JSON at all (truncated/garbled) — the whole batch is
 * lost and the orchestrator should warn + re-ask before fail-safe abstention applies.
 */
export function parseEntailmentResponseDetailed(raw: string): ParsedBatchResponse<UnitEntailment> {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s < 0 || e <= s) return { results: [], parseFailed: true };
    try {
      obj = JSON.parse(raw.slice(s, e + 1));
    } catch {
      return { results: [], parseFailed: true };
    }
  }
  const resultsRaw = Array.isArray((obj as Record<string, unknown>)?.results)
    ? ((obj as Record<string, unknown>).results as unknown[])
    : [];
  const out: UnitEntailment[] = [];
  for (const r of resultsRaw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const ref = typeof rec.ref === "string" ? rec.ref.trim() : "";
    if (!ref) continue;
    const v = typeof rec.verdict === "string" ? rec.verdict.trim() : "";
    // Fail-safe: an unrecognized verdict is an abstention, never a pass.
    const verdict: EntailmentVerdict =
      v === "entailed" || v === "not_entailed" || v === "abstain" ? v : "abstain";
    const confidence =
      typeof rec.confidence === "number" && Number.isFinite(rec.confidence)
        ? Math.min(1, Math.max(0, rec.confidence))
        : null;
    out.push({
      ref,
      verdict,
      confidence,
      ...(typeof rec.note === "string" && rec.note.trim() ? { note: rec.note.trim() } : {}),
      // The fail-safe marker must win over any model-supplied note.
      ...(v !== verdict && v ? { note: `unparseable_verdict: "${v.slice(0, 40)}"` } : {}),
    });
  }
  return { results: out, parseFailed: false };
}

export function parseEntailmentResponse(raw: string): UnitEntailment[] {
  return parseEntailmentResponseDetailed(raw).results;
}

/** Strict-majority vote across k samples; disagreement abstains (→ review). */
export function resolveSelfConsistency(samples: UnitEntailment[]): UnitEntailment {
  if (samples.length === 1) return samples[0]!;
  const counts = new Map<EntailmentVerdict, number>();
  for (const s of samples) counts.set(s.verdict, (counts.get(s.verdict) ?? 0) + 1);
  let winner: EntailmentVerdict | null = null;
  for (const [verdict, n] of counts) {
    if (n * 2 > samples.length) winner = verdict;
  }
  if (!winner) {
    return {
      ref: samples[0]!.ref,
      verdict: "abstain",
      confidence: null,
      note: `self_consistency_disagreement: ${[...counts.entries()]
        .map(([v, n]) => `${v}×${n}`)
        .join(", ")}`,
    };
  }
  const agreeing = samples.filter((s) => s.verdict === winner);
  const confidences = agreeing
    .map((s) => s.confidence)
    .filter((c): c is number => c !== null);
  return {
    ref: samples[0]!.ref,
    verdict: winner,
    confidence:
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : null,
    ...(agreeing[0]?.note ? { note: agreeing[0].note } : {}),
  };
}

/**
 * Judge a set of claims span-scoped, with fail-safe coverage and optional k-sample
 * self-consistency. Claims with no spans never reach the judge — they abstain locally
 * with `no_bound_evidence` (no model can make unbindable evidence supported).
 */
export async function judgeEntailment(args: {
  inputs: EntailmentInput[];
  generate: ExtractionGenerate;
  /** Samples per claim (≥1). Disagreement across samples abstains. */
  kSamples?: number;
  /** Recorded in the returned meta when the caller knows the resolved model. */
  modelId?: string | null;
  /** H1: called when a batch loses verdicts (before the single re-ask + fail-safe abstain). */
  onCoverageShortfall?: CoverageShortfallHandler;
}): Promise<{ results: UnitEntailment[]; meta: EntailmentJudgeMeta }> {
  const kSamples = Math.max(1, Math.floor(args.kSamples ?? 1));
  const meta: EntailmentJudgeMeta = {
    model_id: args.modelId ?? null,
    prompt_version: ENTAILMENT_PROMPT_VERSION,
    judged_at: new Date().toISOString(),
    samples: kSamples,
  };
  if (args.inputs.length === 0) return { results: [], meta };

  const judgeable = args.inputs.filter((i) => i.spans.length > 0);
  const unbound: UnitEntailment[] = args.inputs
    .filter((i) => i.spans.length === 0)
    .map((i) => ({
      ref: i.ref,
      verdict: "abstain" as const,
      confidence: null,
      note: "no_bound_evidence: nothing to entail against",
    }));

  const system = buildEntailmentSystemPrompt();
  const judged: UnitEntailment[] = [];
  for (const { batchInputs, refToUnitId } of buildEntailmentBatchInputs(judgeable)) {
    const samplesByRef = new Map<string, UnitEntailment[]>();
    for (let k = 0; k < kSamples; k++) {
      // H1: a lost batch (truncated/garbled response or omitted refs) is re-asked
      // exactly once per sample; refs still missing after that fall through to the
      // fail-safe `abstain` coverage finalize (→ review), never a pass.
      const asked = await askBatchWithCoverageRetry<EntailmentInput, UnitEntailment>({
        inputs: batchInputs,
        ask: async (inputs) => {
          const raw = await args.generate({ system, user: buildEntailmentUserPrompt(inputs) });
          return parseEntailmentResponseDetailed(raw);
        },
        ...(args.onCoverageShortfall ? { onShortfall: args.onCoverageShortfall } : {}),
      });
      const finalized = finalizeEntailmentCoverage(batchInputs, asked.results);
      for (const r of finalized) {
        const list = samplesByRef.get(r.ref) ?? [];
        list.push(r);
        samplesByRef.set(r.ref, list);
      }
    }
    const resolved = batchInputs.map((i) => resolveSelfConsistency(samplesByRef.get(i.ref)!));
    judged.push(...remapEntailmentBatchResults(resolved, refToUnitId));
  }

  return { results: [...judged, ...unbound], meta };
}
