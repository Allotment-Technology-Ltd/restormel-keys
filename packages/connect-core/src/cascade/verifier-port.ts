/**
 * The single verifier-tier port (restormel-component-plugpoints §"Plug-point architecture
 * — one contract per slot"; REC-ADR-023 §3). Every cascade tier — cheap pre-filter, mid
 * checker, frontier escalation, and the excluded cheap-slot STUB — is an
 * implementation of THIS one interface. That is what makes a tier cleanly removable
 * (D-2026-07-02-1): a rollback deletes the adapter file + its config entry, and the spine
 * (cascade.ts) never changes because it only ever sees `VerifierTier`.
 *
 * The port carries ZERO vendor SDK types (plugpoints gate). A tier that reasons in
 * entailment terms bridges to `Verdict` via verdict.ts#verdictFromEntailment inside its own
 * module; the port surface is neutral.
 *
 * Credentialed / network tier implementations live in the HOST APP, mirroring the
 * GraphStore + EmbeddingPort pattern (ingest-ports.ts). The fixture-backed doubles in
 * tiers/ are the in-repo, keyless implementations used by the harness and the tests; the
 * live adapters (Granite Guardian endpoint, frontier API) are host-app wiring and are
 * reported as "needs credential/GPU", never faked as live.
 */
import type { Verdict } from "./verdict.js";

/** What a single tier is asked to judge: one decontextualized claim bound to one span. */
export interface VerifierRequest {
  /** Stable per-claim id, echoed back on the result (audit trail). */
  ref: string;
  /**
   * The decontextualized claim text (pronouns/ellipsis resolved — skill §3). Stored
   * NEXT TO, never in place of, the verbatim source quote.
   */
  claim: string;
  /** The verbatim bound quote from the cited source version — the tier's whole universe. */
  span: string;
  /**
   * Minimal decontextualizing context (skill §2 "verifier sees the bound quote only"):
   * the immediately surrounding sentence(s), never the whole document. Optional.
   */
  context?: string;
}

/**
 * Authoritative usage + cost for one tier call (skill §8 "authoritative token counts",
 * REC-ADR-023 Decision 4). Read from the provider's `usage` fields by the LIVE adapter,
 * never client-side estimated. Fixture doubles leave this undefined (honest absence) — the
 * cascade then records `null` token/cost and `fixture: true` on the span. A live adapter that
 * populates this is what makes `cost_usd` / cost-per-verified-claim structurally reachable
 * through the shipped seam (not a permanent null placeholder).
 */
export interface VerifierUsage {
  inputTokens: number;
  outputTokens: number;
  /** Cost in USD for this single call, computed by the adapter from authoritative usage. */
  costUsd: number;
}

/** One tier's judgement of one claim. */
export interface VerifierResult {
  ref: string;
  verdict: Verdict;
  /**
   * Calibrated confidence in [0,1], or null when the tier declines to score. The cascade
   * compares this against the tier's calibrated escalation thresholds — NOT inline
   * constants (skill §4).
   */
  confidence: number | null;
  /** Short machine/human reason; never raw vendor payloads (plugpoints redaction rule). */
  note?: string;
  /**
   * Authoritative usage/cost from a LIVE credentialed call (skill §8). Undefined for fixture
   * doubles — the cascade records `null` usage + cost and marks the span `fixture: true`.
   * Present ⇒ the span is a real call: usage/cost populate and the span is `fixture: false`.
   */
  usage?: VerifierUsage;
}

/**
 * A verifier tier. Adapters implement this and register a stable `id` and `modelFamily`
 * (used for the cross-family independence check) plus `modelVersion` and `configHash`
 * (both fold into the verdict-cache key — verdict-cache.ts).
 */
export interface VerifierTier {
  /** Stable discriminant, e.g. "hhem-2.1-open". Greps only to this adapter + config + cache. */
  readonly id: string;
  /**
   * Model family for the cross-model-independence invariant (REC-ADR-023 invariant 1):
   * adjacent tiers, and any tier vs the content author, must differ. E.g. "flan-t5",
   * "granite", "frontier-api". A pure heuristic double reports "none".
   */
  readonly modelFamily: string;
  /** Model version string; part of the cache key so a bump invalidates dependent verdicts. */
  readonly modelVersion: string;
  /**
   * Deterministic hash of the tier's config (temperature, tools, params): part of the cache
   * key (skill §6 full key composition). A pure double returns a constant.
   */
  readonly configHash: string;
  /**
   * Prompt/template version — a DISTINCT, first-class cache-key input (skill §6: prompt
   * version is a mandatory key field on its own, not folded into `configHash`). Keying it
   * separately makes "stale verdicts survive a prompt change" structurally impossible even
   * for a live adapter that computes `configHash` from temperature/tools only. A double sets
   * it to its frozen prompt-version constant.
   */
  readonly promptTemplateVersion: string | number;
  /**
   * Is this tier a STUB (no real verifier wired)? The excluded cheap-slot is a permanent
   * stub — both candidate checkpoints are excluded (REC-GOV-022). A stub tier MUST NOT
   * return a decisive verdict; the cascade skips it and records the reason.
   */
  readonly isStub?: boolean;
  /**
   * Judge one request. On timeout/parse/budget failure the implementation THROWS a named
   * CascadeError (verdict.ts) — it never returns a pass verdict on error. The cascade
   * catches at the tier boundary and resolves to "abstained".
   */
  verify(request: VerifierRequest): Promise<VerifierResult>;
}

/** The fixed cascade tier order (skill §4 "tier order fixed"). */
export type CascadeTierRole = "prefilter" | "mid" | "escalation" | "excluded_cheap_slot";

/** A tier plus its role in the cascade; the config selects one adapter per role. */
export interface CascadeTierSlot {
  role: CascadeTierRole;
  tier: VerifierTier;
}
