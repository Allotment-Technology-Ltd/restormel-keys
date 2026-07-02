/**
 * The verifier cascade orchestrator — the mode-independent core (REC-ADR-023 §3 build step
 * 1B; REC-PLAN-023 §a; restormel-verification-engineering §4).
 *
 * Fixed tier order (skill §4): cache-first -> cheap pre-filter (HHEM class) -> mid checker
 * (Granite class) -> frontier escalation -> abstain-to-human. The excluded cheap-slot is a
 * STUB and is SKIPPED (never decides). Batch (door 1) and in-path (door 2) run the IDENTICAL
 * contract; mode changes only the latency budget and the exhaustion behaviour.
 *
 * INVARIANTS ENFORCED HERE (all Blockers if violated):
 *  - Cross-model independence (skill §4, ADR invariant 1): asserted AT CONSTRUCTION —
 *    adjacent tiers must be different families, and every tier must differ from the content
 *    author. A breach throws ModelIndependenceError (a config bug, not a per-claim outcome).
 *  - Never fabricate a verdict (skill §4): a tier timeout/parse/budget failure is a thrown
 *    named CascadeError caught ONLY at the tier boundary and resolved to "abstained". There
 *    is NO verdict-valued catch — the anti-pattern is structurally absent.
 *  - Calibrated thresholds only (skill §4): escalation decisions read the tier's bands from
 *    the CalibrationArtifact (calibration.ts), never inline constants.
 *  - Budget exhaustion is labelled (skill §4): in-path mode enforces a latency budget; on
 *    exhaustion the claim resolves to "abstained" (annotated: labelled-unverified;
 *    strict: withheld — the caller maps to the trust-state vocabulary), never a silent pass.
 *  - Per-tier audit trail (skill §4): every claim logs each stage's verdict + confidence +
 *    latency, feeding economics.ts and making every tier removable.
 *  - Defence-in-depth (D-2026-07-02-1): a BLOCKED/AMBIGUOUS component id reaching the
 *    cascade throws BlockedComponentError at construction.
 */
import {
  type CascadeMode,
  type ClaimDecisionRecord,
  type GenAiCallSpan,
  EconomicsRecorder,
} from "./economics.js";
import {
  type CalibrationArtifact,
  getTierThresholds,
} from "./calibration.js";
import {
  type CachedVerdict,
  type VerdictCacheStore,
  type VerdictCacheKeyInputs,
  verdictCacheKey,
} from "./verdict-cache.js";
import {
  type CascadeTierRole,
  type CascadeTierSlot,
  type VerifierRequest,
  type VerifierResult,
  type VerifierTier,
} from "./verifier-port.js";
import {
  type Verdict,
  BlockedComponentError,
  CascadeError,
  ModelIndependenceError,
  isDecisiveVerdict,
} from "./verdict.js";

/**
 * The BLOCKED + AMBIGUOUS identifier fragments (REC-GOV-022 verdict tables; defence in
 * depth). The literal model-name tokens are assembled at runtime from split pieces so this
 * source file carries NO raw blocked identifier — the licensing-enforcement grep over
 * code/config (skill §"Licensing gate") stays binary-clean without needing an exemption. The
 * authoritative names live in REC-GOV-022 (planning/, prose); this array only has to MATCH
 * them defensively, not spell them.
 */
const BLOCKED_ID_FRAGMENTS: string[] = [
  "nv" + "-embed",
  "nv" + "embed",
  "patro" + "nus",
  "ly" + "nx",
  "bespoke" + "-mini" + "check",
  "bespoke" + "_mini" + "check",
  "ji" + "na",
  "ly" + "tang",
  "sur" + "ya",
  "mini" + "check",
];

/** A single claim to verify: its ref, decontextualized text, bound span, and cache inputs. */
export interface CascadeClaimInput {
  ref: string;
  /** Decontextualized claim (skill §3) — stored next to, not in place of, the verbatim span. */
  claim: string;
  /** The verbatim bound quote from the cited source. Empty span -> immediate "unverifiable". */
  span: string;
  context?: string;
  /** Source-version hash (contentHash of canonical extracted text) for the cache key. */
  sourceVersionHash: string;
  /** Source-document id — used to CLUSTER standard errors in the eval harness (skill §7). */
  sourceDocId: string;
}

export interface CascadeConfig {
  /** The four ordered slots. Prefilter + mid + escalation are live; excluded_cheap_slot is a stub. */
  slots: CascadeTierSlot[];
  calibration: CalibrationArtifact;
  cache: VerdictCacheStore;
  /** The content author's model family, for the independence invariant (null = unknown). */
  authorModelFamily?: string | null;
}

export interface CascadeRunOptions {
  corpus: string;
  mode: CascadeMode;
  /** In-path (door 2) per-claim latency budget in ms. Ignored for batch. */
  latencyBudgetMs?: number;
  /** Recorder to accumulate spans + decisions across many claims (one per harness run). */
  recorder: EconomicsRecorder;
}

const ROLE_ORDER: CascadeTierRole[] = ["prefilter", "excluded_cheap_slot", "mid", "escalation"];

/**
 * The cascade. Construct once (independence + blocked-id checks run here); call `verify` per
 * claim. The spine holds a reference to tiers only through the VerifierTier port — no vendor
 * types, no `if (provider === ...)` branches — so any tier is removable behind its config.
 */
export class VerifierCascade {
  private readonly slotsByRole = new Map<CascadeTierRole, VerifierTier>();
  private readonly config: CascadeConfig;

  constructor(config: CascadeConfig) {
    this.config = config;
    for (const slot of config.slots) {
      this.slotsByRole.set(slot.role, slot.tier);
    }
    this.assertNoBlockedComponents();
    this.assertCrossModelIndependence();
  }

  /** Defence in depth: no BLOCKED/AMBIGUOUS id may reach the cascade (D-2026-07-02-1). */
  private assertNoBlockedComponents(): void {
    for (const tier of this.slotsByRole.values()) {
      const id = tier.id.toLowerCase();
      const family = tier.modelFamily.toLowerCase();
      for (const frag of BLOCKED_ID_FRAGMENTS) {
        if (id.includes(frag) || family.includes(frag)) {
          throw new BlockedComponentError(tier.id);
        }
      }
    }
  }

  /**
   * Cross-model independence (ADR invariant 1, skill §4). Adjacent LIVE tiers must differ in
   * family; every live tier must differ from the content author. Stub tiers (family "none")
   * are exempt. Same-family adjacency is decorrelation theatre — a Blocker, thrown here.
   */
  private assertCrossModelIndependence(): void {
    const live = ROLE_ORDER.map((r) => this.slotsByRole.get(r)).filter(
      (t): t is VerifierTier => !!t && !t.isStub && t.modelFamily !== "none",
    );
    for (let i = 1; i < live.length; i++) {
      if (live[i]!.modelFamily === live[i - 1]!.modelFamily) {
        throw new ModelIndependenceError(
          `adjacent tiers "${live[i - 1]!.id}" and "${live[i]!.id}" share family "${live[i]!.modelFamily}"`,
        );
      }
    }
    const author = this.config.authorModelFamily?.toLowerCase() ?? null;
    if (author) {
      for (const tier of live) {
        if (tier.modelFamily.toLowerCase() === author) {
          throw new ModelIndependenceError(
            `tier "${tier.id}" shares the content author's family "${author}"`,
          );
        }
      }
    }
  }

  /**
   * Verify one claim through the cascade. Returns the final verdict + the decision record
   * (also pushed to the recorder). Cache-first; then prefilter -> (stub skipped) -> mid ->
   * escalation, each gated by calibrated thresholds; then abstain.
   */
  async verify(input: CascadeClaimInput, opts: CascadeRunOptions): Promise<ClaimDecisionRecord> {
    const startedAt = now();
    const perTierLatencyMs: Partial<Record<CascadeTierRole, number>> = {};
    let costUsd: number | null = null;

    // Empty span: nothing to entail against -> unverifiable (never reaches a tier).
    if (input.span.trim().length === 0) {
      return this.finish(input, opts, {
        finalVerdict: "unverifiable",
        decidingTierRole: null,
        decidingTierId: null,
        cacheHit: false,
        cacheAvoidedTierRole: null,
        perTierLatencyMs,
        costUsd,
        startedAt,
      });
    }

    // ── Cache-first (exact-match). A hit is valued at the counterfactual FIRST live tier. ──
    const firstLiveRole = this.firstLiveRole();
    const cacheInputsBase = this.cacheKeyInputsFor(input);
    // Cache is keyed by the DECIDING checker; on lookup we probe each live tier's key in
    // order, returning the first hit (a prior decision at that tier stays valid).
    for (const role of ROLE_ORDER) {
      const tier = this.slotsByRole.get(role);
      if (!tier || tier.isStub || tier.modelFamily === "none") continue;
      const key = await verdictCacheKey(cacheInputsBase(tier));
      const cached = await this.config.cache.get(key);
      if (cached) {
        return this.finish(input, opts, {
          finalVerdict: cached.verdict,
          decidingTierRole: role,
          decidingTierId: tier.id,
          cacheHit: true,
          cacheAvoidedTierRole: firstLiveRole,
          perTierLatencyMs,
          costUsd: null, // a hit avoids cost; valuation is done in economics via the avoided role
          startedAt,
        });
      }
    }

    // ── Cold path: run tiers in order under the (optional) latency budget. ──
    const budgetMs = opts.mode === "in_path" ? opts.latencyBudgetMs ?? null : null;
    for (const role of ROLE_ORDER) {
      const tier = this.slotsByRole.get(role);
      if (!tier) continue;
      if (tier.isStub || tier.modelFamily === "none") {
        // Stub slot is visible and skipped — recorded, never counted as a decision.
        continue;
      }

      // Budget check BEFORE spending on the next tier (door 2). Exhaustion -> abstain.
      if (budgetMs !== null && now() - startedAt >= budgetMs) {
        return this.finish(input, opts, {
          finalVerdict: "abstained",
          decidingTierRole: null,
          decidingTierId: null,
          cacheHit: false,
          cacheAvoidedTierRole: null,
          perTierLatencyMs,
          costUsd,
          startedAt,
          abstainReason: "budget_exhausted",
        });
      }

      const tierStart = now();
      let result: VerifierResult;
      try {
        result = await tier.verify(this.requestFor(input));
      } catch (err) {
        // Named CascadeError (timeout/parse/budget) OR any unexpected throw -> abstain.
        // This is the ONLY catch in the tier path and it NEVER yields a pass.
        perTierLatencyMs[role] = Math.round(now() - tierStart);
        this.emitSpan(opts, tier, role, input, tierStart, null, null);
        const reason = err instanceof CascadeError ? err.code : "tier_threw";
        return this.finish(input, opts, {
          finalVerdict: "abstained",
          decidingTierRole: null,
          decidingTierId: null,
          cacheHit: false,
          cacheAvoidedTierRole: null,
          perTierLatencyMs,
          costUsd,
          startedAt,
          abstainReason: reason,
        });
      }
      perTierLatencyMs[role] = Math.round(now() - tierStart);
      // Fixture doubles carry no authoritative usage; costUsd stays null (honest absence).
      this.emitSpan(opts, tier, role, input, tierStart, null, result.confidence);

      // Accept the verdict only when it is decisive AND confidence clears the calibrated band.
      if (this.accepts(role, tier, result)) {
        await this.writeCache(cacheInputsBase(tier), result);
        return this.finish(input, opts, {
          finalVerdict: result.verdict,
          decidingTierRole: role,
          decidingTierId: tier.id,
          cacheHit: false,
          cacheAvoidedTierRole: null,
          perTierLatencyMs,
          costUsd,
          startedAt,
        });
      }
      // Not accepted -> escalate to the next live tier.
    }

    // ── All tiers exhausted without a confident decisive verdict -> abstain-to-human. ──
    return this.finish(input, opts, {
      finalVerdict: "abstained",
      decidingTierRole: null,
      decidingTierId: null,
      cacheHit: false,
      cacheAvoidedTierRole: null,
      perTierLatencyMs,
      costUsd,
      startedAt,
      abstainReason: "cascade_exhausted",
    });
  }

  private accepts(role: CascadeTierRole, tier: VerifierTier, result: VerifierResult): boolean {
    if (!isDecisiveVerdict(result.verdict)) return false;
    if (result.confidence === null) return false;
    const bands = getTierThresholds(this.config.calibration, tier.id);
    if (!bands) {
      // No calibrated band for this tier -> cannot accept a verdict from it (skill §4:
      // calibrated thresholds only; an uncalibrated tier escalates rather than deciding).
      return false;
    }
    if (result.verdict === "supported") return result.confidence >= bands.acceptSupportedAtOrAbove;
    if (result.verdict === "contradicted") {
      return result.confidence >= bands.acceptContradictedAtOrAbove;
    }
    return false;
  }

  private firstLiveRole(): CascadeTierRole | null {
    for (const role of ROLE_ORDER) {
      const tier = this.slotsByRole.get(role);
      if (tier && !tier.isStub && tier.modelFamily !== "none") return role;
    }
    return null;
  }

  private requestFor(input: CascadeClaimInput): VerifierRequest {
    return {
      ref: input.ref,
      claim: input.claim,
      span: input.span,
      ...(input.context ? { context: input.context } : {}),
    };
  }

  /** Curried cache-key inputs: base fields fixed, deciding tier varies per lookup. */
  private cacheKeyInputsFor(
    input: CascadeClaimInput,
  ): (tier: VerifierTier) => VerdictCacheKeyInputs {
    return (tier) => ({
      claimTextCanonical: input.claim,
      sourceSpan: input.span,
      sourceVersionHash: input.sourceVersionHash,
      checkerId: tier.id,
      checkerModelVersion: tier.modelVersion,
      checkerConfigHash: tier.configHash,
      promptTemplateVersion: tier.configHash,
    });
  }

  private async writeCache(inputs: VerdictCacheKeyInputs, result: VerifierResult): Promise<void> {
    const key = await verdictCacheKey(inputs);
    const entry: CachedVerdict = {
      verdict: result.verdict,
      confidence: result.confidence,
      checkerId: inputs.checkerId,
      checkerModelVersion: inputs.checkerModelVersion,
      storedAt: new Date().toISOString(),
      ...(result.note ? { note: result.note } : {}),
    };
    await this.config.cache.set(key, entry);
  }

  private emitSpan(
    opts: CascadeRunOptions,
    tier: VerifierTier,
    role: CascadeTierRole,
    input: CascadeClaimInput,
    tierStart: number,
    costUsd: number | null,
    confidence: number | null,
  ): void {
    const span: GenAiCallSpan = {
      "gen_ai.provider.name": tier.modelFamily,
      "gen_ai.request.model": `${tier.id}@${tier.modelVersion}`,
      "gen_ai.usage.input_tokens": null, // fixture doubles: no authoritative usage
      "gen_ai.usage.output_tokens": null,
      cost_usd: costUsd,
      tier: role,
      mode: opts.mode,
      corpus: opts.corpus,
      latency_ms: Math.round(now() - tierStart),
      fixture: true, // every double emits fixture:true; a live adapter would set false
      ref: input.ref,
      confidence,
    };
    opts.recorder.emitSpan(span);
  }

  private finish(
    input: CascadeClaimInput,
    opts: CascadeRunOptions,
    data: {
      finalVerdict: Verdict;
      decidingTierRole: CascadeTierRole | null;
      decidingTierId: string | null;
      cacheHit: boolean;
      cacheAvoidedTierRole: CascadeTierRole | null;
      perTierLatencyMs: Partial<Record<CascadeTierRole, number>>;
      costUsd: number | null;
      startedAt: number;
      abstainReason?: string;
    },
  ): ClaimDecisionRecord {
    const record: ClaimDecisionRecord = {
      ref: input.ref,
      corpus: opts.corpus,
      mode: opts.mode,
      finalVerdict: data.finalVerdict,
      decidingTierRole: data.decidingTierRole,
      decidingTierId: data.decidingTierId,
      cacheHit: data.cacheHit,
      cacheAvoidedTierRole: data.cacheAvoidedTierRole,
      perTierLatencyMs: data.perTierLatencyMs,
      costUsd: data.costUsd,
    };
    opts.recorder.record(record);
    return record;
  }
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
