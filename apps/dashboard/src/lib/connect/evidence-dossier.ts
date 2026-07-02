/**
 * Evidence Dossier (W2.2) — shared, client-safe helpers for the claim-level
 * "why is this trusted" panel and the explorer's Evidence facet.
 *
 * Truth source: EBV verification states (docs/decisions/evidence-bound-verification.md).
 * The invariants this module encodes are the PROVEN claims-ledger rows:
 *   row 2  — `supported` requires a deterministically bound evidence span; an unbound
 *            claim can never be accepted into `supported` (see canAcceptAsSupported).
 *   row 9  — the Layer-1 re-check fails closed (hash mismatch / changed text / bad
 *            offsets) — recheckResultCopy never softens a failure.
 *   row 10 — abstention and low confidence land in `unverified` (review), which is why
 *            the URL alias `abstained` maps onto the `unverified` facet.
 */
import type { VerificationStateFilter } from "$lib/connect/explorer-url-state";

export const VERIFICATION_STATES = [
  "supported",
  "inferred",
  "unverified",
  "contradicted",
  "excluded",
] as const;

export type VerificationState = (typeof VERIFICATION_STATES)[number];

export function isVerificationState(v: unknown): v is VerificationState {
  return typeof v === "string" && (VERIFICATION_STATES as readonly string[]).includes(v);
}

/** Normalize a raw store value; null = no EBV row (claim predates evidence binding). */
export function normalizeVerificationState(raw: unknown): VerificationState | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return isVerificationState(v) ? v : null;
}

export type EvidenceBindingStatus = "bound" | "unbound" | "no_evidence";

export function normalizeEvidenceStatus(raw: unknown): EvidenceBindingStatus | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return v === "bound" || v === "unbound" || v === "no_evidence" ? v : null;
}

/**
 * Passage fidelity of a bound span (RES-113 placement spec §3.2, PR-7).
 * Mirrors the extraction `source_locator` kinds (REC-TECH-014): `"spatial"` spans
 * render exactly as today with no note; `"textual"` spans carry the registered
 * §3.5 fidelity note — the note's presence is the only signal. Tier names
 * (A/B) never appear anywhere in UI or in this module's output.
 */
export type EvidenceSpanFidelity = "spatial" | "textual";

/**
 * Normalize a raw stored locator-kind marker to a span fidelity. Only an explicit
 * `"textual"` marker downgrades; everything else — including absent (every span
 * bound before the discriminant existed) — is `"spatial"`, so shipped spans keep
 * rendering byte-identically (the §3.5 "renders exactly as today, with no note" pin).
 */
export function normalizeEvidenceFidelity(raw: unknown): EvidenceSpanFidelity {
  return typeof raw === "string" && raw.trim().toLowerCase() === "textual"
    ? "textual"
    : "spatial";
}

/**
 * Textual-fidelity note (copy pack §3.5, verbatim). Rendered in-dossier only when
 * `fidelity === "textual"`; a spatial span renders no note.
 */
export const EVIDENCE_TEXTUAL_FIDELITY_NOTE =
  "Source passage shown as text — this document type doesn't support a visual highlight." as const;

/**
 * The fidelity note for a bound span, or null when no note renders (spatial —
 * exactly today's rendering). "State earns pixels": the note's presence is the
 * only signal, carried by text, never by colour alone (R3-A3).
 */
export function evidenceFidelityNote(
  span: Pick<UnitEvidenceSpan, "fidelity"> | null | undefined,
): string | null {
  return span?.fidelity === "textual" ? EVIDENCE_TEXTUAL_FIDELITY_NOTE : null;
}

/** Bound span as carried by the units API (camelCase over the wire, like Unit). */
export type UnitEvidenceSpan = {
  quote: string;
  start: number;
  end: number;
  /** exact | normalized | fuzzy — anything looser than exact is labeled, never hidden. */
  match: string;
  sourceHash: string;
  /** Passage fidelity (spec §3.2): spatial renders as today; textual carries the §3.5 note. */
  fidelity: EvidenceSpanFidelity;
};

export type UnitJudgeView = {
  /** Judge model id (Layer 2) — null when only Layer 1 / legacy validation ran. */
  model: string | null;
  promptVersion: number | null;
  verdict: string | null;
  confidence: number | null;
  judgedAt: string | null;
};

/** Additive per-unit EBV summary carried by the units API (W2.2). */
export type UnitEvidenceSummary = {
  verificationState: VerificationState | null;
  evidenceStatus: EvidenceBindingStatus | null;
  evidence: UnitEvidenceSpan | null;
  /** Attribution string from the verification-state write (model#pv2, rule name, operator). */
  judgedBy: string | null;
  judgedAt: string | null;
  /** Latest Layer-2 entailment judgment, when one exists. */
  judge: UnitJudgeView | null;
  /** Claim-version chain summary; null = store could not answer (e.g. BYO without opt-in). */
  versions: { count: number; currentVersionNo: number | null } | null;
  /** When the evidence row was written (the "validated" date in the stamp ring). */
  boundAt: string | null;
};

/** True when the unit has no EBV row at all — ingested before evidence binding. */
export function predatesEvidenceBinding(
  summary: Pick<UnitEvidenceSummary, "verificationState" | "evidenceStatus"> | null | undefined,
): boolean {
  if (!summary) return true;
  return summary.verificationState == null && summary.evidenceStatus == null;
}

/**
 * Accept guard (claims ledger row 2): a claim may be accepted into `supported`
 * ONLY when its evidence span is Layer-1 bound. Everything else gets an honest
 * refusal reason for the UI to show verbatim.
 */
export function canAcceptAsSupported(
  summary: Pick<UnitEvidenceSummary, "verificationState" | "evidenceStatus"> | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (predatesEvidenceBinding(summary)) {
    return {
      ok: false,
      reason: "This claim predates evidence binding — re-ingest its source to bind a span first.",
    };
  }
  if (summary?.evidenceStatus === "bound") return { ok: true };
  if (summary?.evidenceStatus === "no_evidence") {
    return {
      ok: false,
      reason:
        "No evidence span could be bound — this claim can never be marked supported.",
    };
  }
  return {
    ok: false,
    reason:
      "The evidence quote does not bind to the cited source — an unbound claim can never be marked supported.",
  };
}

// ── Dossier wire types (shared between the API route and the explorer panel) ─

export type EvidenceExcerpt =
  | {
      located: "offsets" | "search";
      before: string;
      /** Verbatim text at the located position in the CURRENT source text. */
      quote: string;
      after: string;
    }
  | {
      located: "none";
      reason: "no_bound_span" | "source_text_unavailable" | "quote_not_in_current_text";
    };

export type ConnectEvidenceDossier = {
  unitId: string;
  predatesEvidenceBinding: boolean;
  summary: UnitEvidenceSummary | null;
  source: { title: string | null; url: string | null; kind: string | null };
  /** Quality of the resolved source text the excerpt was built from. */
  sourceTextQuality: "full" | "preview" | "missing";
  excerpt: EvidenceExcerpt | null;
  judgments: {
    verdict: string;
    confidence: number | null;
    judgeModel: string | null;
    promptVersion: number | null;
    judgedAt: string | null;
    note: string | null;
  }[];
  versions:
    | {
        versionNo: number;
        verificationState: string | null;
        validFrom: string | null;
        validTo: string | null;
        superseded: boolean;
        current: boolean;
      }[]
    | null;
};

// ── Evidence facet ──────────────────────────────────────────────────────────

/**
 * Map an inbound `?filter=` verification value to the facet that acts on it.
 * `abstained` is an alias for the `unverified` facet (ledger row 10: abstention
 * routes to review, never to a passing state).
 */
export function facetForUrlFilter(filter: VerificationStateFilter): VerificationState {
  return filter === "abstained" ? "unverified" : filter;
}

/** The `?filter=` value written when a facet is active (identity — every state is a value). */
export function urlFilterForFacet(state: VerificationState): VerificationStateFilter {
  return state;
}

/** True when the unit belongs to the given Evidence facet. */
export function unitMatchesEvidenceFacet(
  unitState: VerificationState | null,
  facet: VerificationState,
): boolean {
  return unitState === facet;
}

// ── Stamp + chip visuals (restormel-neu-brutalist tokens; classes styled in the explorer) ──

export type VerificationStampVisual = {
  /** Uppercase mono stamp text. */
  stamp: string;
  label: string;
  /** What the state means, in ledger-proven terms (hover/sr text). */
  meaning: string;
  chipClass: string;
  stampClass: string;
};

export const VERIFICATION_STATE_VISUAL: Record<VerificationState, VerificationStampVisual> = {
  supported: {
    stamp: "SUPPORTED",
    label: "Supported",
    meaning:
      "Evidence-bound and entailed: a verbatim quote at recorded offsets in the cited source, affirmed by the judge.",
    chipClass: "evidence-chip--supported",
    stampClass: "dossier-stamp--supported",
  },
  inferred: {
    stamp: "INFERRED",
    label: "Inferred",
    meaning:
      "Entailed but no bound span in the cited source — always labeled as inference, never supported.",
    chipClass: "evidence-chip--inferred",
    stampClass: "dossier-stamp--inferred",
  },
  unverified: {
    stamp: "UNVERIFIED",
    label: "Unverified",
    meaning:
      "Awaiting review: the judge abstained, confidence was low, or no evidence could be bound.",
    chipClass: "evidence-chip--unverified",
    stampClass: "dossier-stamp--unverified",
  },
  contradicted: {
    stamp: "CONTRADICTED",
    label: "Contradicted",
    meaning: "Evidence entails the negation — excluded from strict retrieval until resolved.",
    chipClass: "evidence-chip--contradicted",
    stampClass: "dossier-stamp--contradicted",
  },
  excluded: {
    stamp: "EXCLUDED",
    label: "Excluded",
    meaning: "Soft-excluded by remediation or an operator — reversible, kept on the record.",
    chipClass: "evidence-chip--excluded",
    stampClass: "dossier-stamp--excluded",
  },
};

/** Stamp for a unit with no EBV row at all. */
export const PRE_EBV_STAMP: VerificationStampVisual = {
  stamp: "UNBOUND",
  label: "Predates evidence binding",
  meaning:
    "Ingested before evidence binding — re-ingest the source to bind a span and verify this claim.",
  chipClass: "evidence-chip--pre-ebv",
  stampClass: "dossier-stamp--pre-ebv",
};

export function verificationStampVisual(
  state: VerificationState | null,
): VerificationStampVisual {
  return state ? VERIFICATION_STATE_VISUAL[state] : PRE_EBV_STAMP;
}

// ── Re-check (Layer 1, deterministic) ───────────────────────────────────────

export type RecheckOutcome =
  | { ok: true; match: string; checkedAt: string }
  | {
      ok: false;
      reason:
        | "hash_mismatch"
        | "offsets_out_of_range"
        | "text_changed"
        | "source_text_unavailable"
        | "no_bound_span";
      checkedAt: string;
    };

/**
 * Honest, fail-closed copy for re-check outcomes (ledger row 9). A failed re-check
 * is reported as exactly what it is — never softened into a warning.
 */
export function recheckResultCopy(outcome: RecheckOutcome): { headline: string; detail: string } {
  if (outcome.ok) {
    return {
      headline: `RE-CHECK PASSED · ${outcome.match.toUpperCase()} MATCH`,
      detail:
        "The source still hashes the same and the quote still sits at its recorded offsets. Verified with no model — you can re-run this any time.",
    };
  }
  switch (outcome.reason) {
    case "hash_mismatch":
      return {
        headline: "RE-CHECK FAILED · SOURCE CHANGED",
        detail:
          "The source content no longer hashes to the version this span was bound against. The binding is stale — re-ingest to re-bind.",
      };
    case "text_changed":
      return {
        headline: "RE-CHECK FAILED · TEXT CHANGED AT OFFSETS",
        detail:
          "The text at the recorded offsets no longer carries the quote. Verification fails closed — this claim should not be treated as supported.",
      };
    case "offsets_out_of_range":
      return {
        headline: "RE-CHECK FAILED · OFFSETS OUT OF RANGE",
        detail:
          "The recorded offsets fall outside the current source text. Verification fails closed — re-ingest to re-bind.",
      };
    case "no_bound_span":
      return {
        headline: "NOTHING TO RE-CHECK",
        detail: "This claim has no bound evidence span, so there is no span to verify.",
      };
    case "source_text_unavailable":
    default:
      return {
        headline: "RE-CHECK UNAVAILABLE · SOURCE TEXT MISSING",
        detail:
          "The full source text could not be resolved from your stores, so the span cannot be re-verified. Import the source text in Pipeline → Sources.",
      };
  }
}
