/**
 * EBV Layer 1 wiring helpers (pure — testable without a graph store).
 * Maps extraction output → writer.setEvidence rows, and finalized validation verdicts →
 * writer.setVerificationStates rows, per the approved ADRs.
 */
import {
  bindEvidenceSpan,
  deriveLayer1State,
  deriveLayer2State,
  type ClaimVerificationState,
  type EntailmentJudgeMeta,
  type EvidenceBinding,
  type ExtractedUnit,
  type UnitEntailment,
  type UnitValidationStatus,
} from "@restormel/connect-core";

export type EvidenceRow = { unitId: string; text: string; binding: EvidenceBinding };

export type EvidenceRowsResult = {
  rows: EvidenceRow[];
  bindingByUnitId: Map<string, EvidenceBinding>;
  counts: { bound: number; unbound: number; no_evidence: number };
};

/**
 * Bind each STORED unit's evidence quote (from its extraction twin, by localId) against
 * the full source version text. Binding against the source (not the chunk) keeps offsets
 * source-level, which is what traces and re-checks want.
 */
export function buildEvidenceRows(args: {
  extractedUnits: Pick<ExtractedUnit, "id" | "evidence">[];
  storedUnits: { id: string; localId: string; text: string }[];
  sourceText: string;
  sourceHash: string;
}): EvidenceRowsResult {
  const evidenceByLocal = new Map(args.extractedUnits.map((u) => [u.id, u.evidence ?? ""]));
  const rows: EvidenceRow[] = [];
  const bindingByUnitId = new Map<string, EvidenceBinding>();
  const counts = { bound: 0, unbound: 0, no_evidence: 0 };
  for (const su of args.storedUnits) {
    const binding = bindEvidenceSpan({
      quote: evidenceByLocal.get(su.localId) ?? "",
      sourceText: args.sourceText,
      sourceHash: args.sourceHash,
    });
    counts[binding.status] += 1;
    rows.push({ unitId: su.id, text: su.text, binding });
    bindingByUnitId.set(su.id, binding);
  }
  return { rows, bindingByUnitId, counts };
}

export type StateRow = { unitId: string; state: ClaimVerificationState; judgedBy?: string | null };

/**
 * Compose finalized validation verdicts with Layer-1 bindings into verification states.
 * Units with no recorded binding (e.g. evidence persistence skipped) are treated as
 * unbound — they can be inferred at best, never supported.
 */
export function buildVerificationStateRows(args: {
  verdicts: { unitId: string; status: UnitValidationStatus }[];
  bindingByUnitId: Map<string, EvidenceBinding>;
  judgedBy?: string | null;
}): { states: StateRow[]; counts: Record<ClaimVerificationState, number> } {
  const counts: Record<ClaimVerificationState, number> = {
    supported: 0,
    inferred: 0,
    unverified: 0,
    contradicted: 0,
    excluded: 0,
  };
  const states: StateRow[] = args.verdicts.map((v) => {
    const binding =
      args.bindingByUnitId.get(v.unitId) ??
      ({ status: "unbound", reason: "quote_not_found" } as EvidenceBinding);
    const state = deriveLayer1State({ binding, legacyVerdict: v.status });
    counts[state] += 1;
    return { unitId: v.unitId, state, judgedBy: args.judgedBy ?? null };
  });
  return { states, counts };
}

export type JudgmentRow = {
  unitId: string;
  verdict: UnitEntailment["verdict"];
  confidence: number | null;
  note: string | null;
  judgeModel: string | null;
  promptVersion: number;
  judgedAt: string;
};

/**
 * EBV Layer 2 (Stage 1.0d): compose span-scoped entailment verdicts with Layer-1
 * bindings into verification states, plus append-only judgment rows (audit history —
 * a re-judged claim keeps every prior verdict). `supported` requires bound AND entailed.
 */
export function buildLayer2StateRows(args: {
  results: UnitEntailment[];
  bindingByUnitId: Map<string, EvidenceBinding>;
  meta: EntailmentJudgeMeta;
}): {
  states: StateRow[];
  judgments: JudgmentRow[];
  counts: Record<ClaimVerificationState, number>;
  abstained: string[];
} {
  const counts: Record<ClaimVerificationState, number> = {
    supported: 0,
    inferred: 0,
    unverified: 0,
    contradicted: 0,
    excluded: 0,
  };
  const judgedBy = `${args.meta.model_id ?? "unknown"}#pv${args.meta.prompt_version}`;
  const abstained: string[] = [];
  const states: StateRow[] = [];
  const judgments: JudgmentRow[] = [];
  for (const r of args.results) {
    const binding =
      args.bindingByUnitId.get(r.ref) ??
      ({ status: "unbound", reason: "quote_not_found" } as EvidenceBinding);
    const state = deriveLayer2State({
      binding,
      verdict: r.verdict,
      confidence: r.confidence,
    });
    counts[state] += 1;
    if (r.verdict === "abstain") abstained.push(r.ref);
    states.push({ unitId: r.ref, state, judgedBy });
    judgments.push({
      unitId: r.ref,
      verdict: r.verdict,
      confidence: r.confidence,
      note: r.note ?? null,
      judgeModel: args.meta.model_id,
      promptVersion: args.meta.prompt_version,
      judgedAt: args.meta.judged_at,
    });
  }
  return { states, judgments, counts, abstained };
}
