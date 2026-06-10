/**
 * Verified-claim envelopes for Connect v1 retrieval responses (Stage 1.1).
 *
 * Exposure, not new verification logic: this module projects what the pipeline already
 * persists — EBV verification states (`verification_state`), Layer-1 evidence bindings
 * (`evidence_*` unit fields), and Layer-2 entailment judgments (`connect_claim_judgment`
 * audit rows) — into the @restormel/contracts `VerifiedClaimEnvelope` per returned unit.
 *
 * Fail-safe direction: enrichment is best-effort and can only DEMOTE. A claim whose
 * evidence cannot be read is treated as unbound (never supported via the legacy mapping);
 * EBV states written by the pipeline pass through unchanged. Enrichment failures never
 * break retrieval and never invent verification.
 */
import type { GraphStore, RetrievedClaim, VerificationConfig } from "@restormel/graphrag-core";
import {
  deriveLayer1State,
  type ClaimVerificationState,
  type EvidenceBinding,
  type UnitValidationStatus,
} from "@restormel/connect-core";
import type {
  VerifiedClaimEnvelope,
  VerifiedClaimEvidence,
  VerifiedClaimState,
  VerifiedClaimSummary,
} from "@restormel/contracts";
import { formatSurrealRecordId } from "$lib/server/connect/graph-writer";

/** The subset of a retrieved claim the envelope needs. */
export type VerifiedClaimSourceClaim = Pick<
  RetrievedClaim,
  "id" | "text" | "source_title" | "verification_state" | "trust_score"
>;

/** Per-unit EBV Layer-1 fields as persisted by the graph writers (Surreal read path). */
export type ClaimEvidenceRow = {
  id: unknown;
  evidence_quote?: string | null;
  evidence_start?: number | null;
  evidence_end?: number | null;
  evidence_match?: string | null;
  evidence_status?: string | null;
  evidence_source_hash?: string | null;
  source_ref?: unknown;
};

/** One append-only entailment judgment row (EBV Layer 2 audit history). */
export type ClaimJudgmentRow = {
  unit?: unknown;
  verdict?: string;
  confidence?: number | null;
  judge_model?: string | null;
  prompt_version?: number;
  judged_at?: string;
};

const EBV_STATES: ReadonlySet<string> = new Set([
  "supported",
  "inferred",
  "unverified",
  "contradicted",
  "excluded",
] satisfies ClaimVerificationState[]);

const MATCH_KINDS: ReadonlySet<string> = new Set(["exact", "normalized", "fuzzy"]);

/** Coerce a Surreal id value (string or RecordId object) to its string form. */
function recordIdString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return formatSurrealRecordId(value);
}

/** Reconstruct the persisted Layer-1 binding from an enrichment row (absent row ⇒ unbound). */
export function bindingFromEvidenceRow(row: ClaimEvidenceRow | undefined): EvidenceBinding {
  if (
    row &&
    row.evidence_status === "bound" &&
    typeof row.evidence_quote === "string" &&
    typeof row.evidence_start === "number" &&
    typeof row.evidence_end === "number"
  ) {
    return {
      status: "bound",
      span: {
        quote: row.evidence_quote,
        start: row.evidence_start,
        end: row.evidence_end,
        source_hash: row.evidence_source_hash ?? "",
        match: MATCH_KINDS.has(row.evidence_match ?? "")
          ? (row.evidence_match as "exact" | "normalized" | "fuzzy")
          : "exact",
      },
    };
  }
  if (row && row.evidence_status === "no_evidence") {
    return { status: "no_evidence", reason: "extractor_returned_no_quote" };
  }
  return { status: "unbound", reason: "quote_not_found" };
}

/**
 * Envelope state for a claim. EBV states written by the pipeline pass through verbatim;
 * legacy / pre-EBV vocabularies (e.g. `validated` / `flagged` on imported graphs) are
 * normalized through the SAME interim Layer-1 rule the writers use (deriveLayer1State):
 * a legacy-affirmed claim without a bound span in its cited source is at best `inferred`,
 * never `supported`; flagged or unknown states are `unverified` (reviewable), and the
 * envelope never silently blends them in as verified.
 */
export function toEnvelopeState(args: {
  rawState: string | null | undefined;
  binding: EvidenceBinding;
  vocabulary: Pick<VerificationConfig, "supportedStates" | "flaggedStates">;
}): VerifiedClaimState {
  const raw = args.rawState ?? null;
  if (raw && EBV_STATES.has(raw)) return raw as VerifiedClaimState;
  const legacyVerdict: UnitValidationStatus | "omitted" =
    raw && args.vocabulary.supportedStates.includes(raw)
      ? "ok"
      : raw && args.vocabulary.flaggedStates.includes(raw)
        ? "unsupported"
        : "omitted";
  return deriveLayer1State({ binding: args.binding, legacyVerdict });
}

/**
 * Fetch per-unit evidence bindings and the latest entailment judgments for the returned
 * claim ids. Best-effort: a store that lacks the EBV fields/tables (or errors) yields
 * empty maps — the composer then derives honest states from what it has.
 */
export async function fetchVerifiedClaimEnrichment(args: {
  store: GraphStore;
  unitTable: string;
  claimIds: string[];
}): Promise<{ evidence: Map<string, ClaimEvidenceRow>; judgments: Map<string, ClaimJudgmentRow> }> {
  const evidence = new Map<string, ClaimEvidenceRow>();
  const judgments = new Map<string, ClaimJudgmentRow>();
  if (args.claimIds.length === 0) return { evidence, judgments };

  try {
    const rows = await args.store.query<ClaimEvidenceRow[]>(
      `SELECT id, evidence_quote, evidence_start, evidence_end, evidence_match,
        evidence_status, evidence_source_hash, source AS source_ref
        FROM ${args.unitTable} WHERE id INSIDE $ids`,
      { ids: args.claimIds },
    );
    for (const row of Array.isArray(rows) ? rows : []) {
      const id = recordIdString(row.id);
      if (id) evidence.set(id, row);
    }
  } catch {
    // EBV fields not present / store error — envelopes fall back to unbound semantics.
  }

  try {
    const rows = await args.store.query<ClaimJudgmentRow[]>(
      `SELECT unit, verdict, confidence, judge_model, prompt_version, judged_at
        FROM connect_claim_judgment WHERE unit INSIDE $ids
        ORDER BY judged_at DESC LIMIT 2000`,
      { ids: args.claimIds },
    );
    for (const row of Array.isArray(rows) ? rows : []) {
      const unitId = recordIdString(row.unit);
      if (!unitId || judgments.has(unitId)) continue; // DESC order ⇒ first row is latest
      judgments.set(unitId, row);
    }
  } catch {
    // No judgment table yet (Layer 2 not run) — judge attribution is simply omitted.
  }

  return { evidence, judgments };
}

/** Pure composition: claims + enrichment rows → envelopes + per-state summary. */
export function composeVerifiedClaims(args: {
  claims: VerifiedClaimSourceClaim[];
  evidence: Map<string, ClaimEvidenceRow>;
  judgments: Map<string, ClaimJudgmentRow>;
  vocabulary: Pick<VerificationConfig, "supportedStates" | "flaggedStates">;
  traceId?: string;
}): { envelopes: VerifiedClaimEnvelope[]; summary: VerifiedClaimSummary } {
  const traceRef = args.traceId ? `/connect/v1/traces/${args.traceId}` : null;
  const summary: VerifiedClaimSummary = {};
  const envelopes = args.claims.map((claim) => {
    const row = args.evidence.get(claim.id);
    const binding = bindingFromEvidenceRow(row);
    const state = toEnvelopeState({
      rawState: claim.verification_state,
      binding,
      vocabulary: args.vocabulary,
    });
    summary[state] = (summary[state] ?? 0) + 1;

    const evidence: VerifiedClaimEvidence[] =
      binding.status === "bound"
        ? [
            {
              quote: binding.span.quote,
              offsets: [binding.span.start, binding.span.end],
              source_ref: recordIdString(row?.source_ref),
              source_hash: binding.span.source_hash || null,
              match: binding.span.match,
            },
          ]
        : [];

    const judgment = args.judgments.get(claim.id);
    const judge: VerifiedClaimEnvelope["judge"] =
      judgment && typeof judgment.judged_at === "string"
        ? {
            model: judgment.judge_model ?? null,
            prompt_version:
              typeof judgment.prompt_version === "number" && judgment.prompt_version > 0
                ? Math.floor(judgment.prompt_version)
                : 1,
            confidence:
              typeof judgment.confidence === "number" && Number.isFinite(judgment.confidence)
                ? Math.min(1, Math.max(0, judgment.confidence))
                : null,
            at: judgment.judged_at,
          }
        : undefined;

    return {
      claim: { id: claim.id, text: claim.text },
      state,
      evidence,
      ...(judge ? { judge } : {}),
      citation: claim.source_title || null,
      trace_ref: traceRef,
      trust_score: typeof claim.trust_score === "number" ? claim.trust_score : null,
    } satisfies VerifiedClaimEnvelope;
  });
  return { envelopes, summary };
}

/** Fetch + compose. Never throws; enrichment failures degrade to unbound semantics. */
export async function buildVerifiedClaims(args: {
  store: GraphStore;
  unitTable: string;
  vocabulary: Pick<VerificationConfig, "supportedStates" | "flaggedStates">;
  claims: VerifiedClaimSourceClaim[];
  traceId?: string;
}): Promise<{ envelopes: VerifiedClaimEnvelope[]; summary: VerifiedClaimSummary }> {
  const { evidence, judgments } = await fetchVerifiedClaimEnrichment({
    store: args.store,
    unitTable: args.unitTable,
    claimIds: args.claims.map((c) => c.id),
  });
  return composeVerifiedClaims({
    claims: args.claims,
    evidence,
    judgments,
    vocabulary: args.vocabulary,
    traceId: args.traceId,
  });
}
