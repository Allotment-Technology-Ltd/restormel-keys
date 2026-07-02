/**
 * Unit-economics instrumentation (REC-ADR-023 Decision 4; REC-PLAN-023 §f; OTel GenAI
 * semantic conventions; restormel-verification-engineering §8).
 *
 * The FIVE first-class metrics (skill §8), reported PER CORPUS and PER MODE:
 *   1. cost per verified claim (with CIs; decomposable as C = c_cheap + β·c_expensive)
 *   2. cache-hit rate
 *   3. tier distribution (which tier decided each claim)
 *   4. abstention rate
 *   5. latency per tier
 *
 * Every model call emits an OTel GenAI span carrying `gen_ai.provider.name`,
 * `gen_ai.request.model`, `gen_ai.usage.input_tokens`/`output_tokens`, plus the custom
 * `cost_usd`, `tier`, `mode`, `corpus` attributes (skill §8). Token counts are AUTHORITATIVE
 * — read from provider `usage`, never client-side estimated (skill §8; a client-side
 * estimator here would fail the grep). Fixture doubles report `null` usage, which is
 * recorded honestly as "no authoritative usage" rather than a fabricated estimate.
 *
 * Cache hits are valued at the COUNTERFACTUAL tier cost they avoided (skill §8): a hit that
 * short-circuits the frontier tier is worth the frontier call. `escalationRate` (β) is a
 * live SLO input — verifier drift silently escalates all traffic and destroys unit
 * economics (skill §8).
 *
 * This module owns WHAT every call must carry; HOW those calls get routed
 * (routes/pools/resolve) belongs to restormel-keys-routing.
 */
import type { CascadeTierRole } from "./verifier-port.js";
import type { Verdict } from "./verdict.js";

/** Consumption mode (REC-ADR-023 §3 modes). */
export type CascadeMode = "batch" | "in_path";

/**
 * OTel GenAI span for one model call. Attribute names track the GenAI semantic conventions;
 * usage token fields are `null` for fixture doubles (honest absence, not a zero estimate).
 */
export interface GenAiCallSpan {
  "gen_ai.provider.name": string;
  "gen_ai.request.model": string;
  "gen_ai.usage.input_tokens": number | null;
  "gen_ai.usage.output_tokens": number | null;
  /** Custom attributes (skill §8). */
  cost_usd: number | null;
  tier: string;
  mode: CascadeMode;
  corpus: string;
  /** Wall time of the call in ms. */
  latency_ms: number;
  /** True when this span represents a fixture double, not a live provider call. */
  fixture: boolean;
  /** Per-claim ref this call judged (lets the harness join spans to claims for AUROC). */
  ref: string;
  /** The tier's calibrated confidence on this call (drives stage-1 informativeness AUROC). */
  confidence: number | null;
}

/** One claim's decision record — the per-tier audit trail (skill §4). */
export interface ClaimDecisionRecord {
  ref: string;
  corpus: string;
  mode: CascadeMode;
  finalVerdict: Verdict;
  /** The role of the tier that decided the claim, or null when it abstained past all tiers. */
  decidingTierRole: CascadeTierRole | null;
  decidingTierId: string | null;
  /** True when the verdict was served from the verdict cache (no tier ran). */
  cacheHit: boolean;
  /**
   * When cacheHit, the counterfactual tier role the hit avoided (for honest hit valuation,
   * skill §8). Null when the claim was cold-computed.
   */
  cacheAvoidedTierRole: CascadeTierRole | null;
  /** Per-tier latency for the tiers that actually ran on this claim. */
  perTierLatencyMs: Partial<Record<CascadeTierRole, number>>;
  /** Sum of authoritative model cost for this claim; null if no authoritative usage seen. */
  costUsd: number | null;
}

/** Wilson-free normal-approx CI for a proportion; SE clustered by source doc where relevant. */
export interface Estimate {
  value: number;
  /** Standard error. */
  se: number;
  /** 95% CI half-width (1.96·SE). */
  ci95: number;
  n: number;
}

export interface EconomicsReport {
  corpus: string;
  mode: CascadeMode;
  claims: number;
  /** Metric 1: cost per verified (decisive) claim, with CI. */
  costPerVerifiedClaim: Estimate;
  /** Metric 2: cache-hit rate, with CI. */
  cacheHitRate: Estimate;
  /** Metric 3: tier distribution — share of claims decided by each tier role + cache. */
  tierDistribution: Record<string, number>;
  /** Metric 4: abstention rate, with CI. */
  abstentionRate: Estimate;
  /** Metric 5: mean latency per tier role (ms). */
  latencyPerTierMs: Partial<Record<CascadeTierRole, number>>;
  /** β — escalation rate: share of claims that REACHED the escalation tier (live SLO input). */
  escalationRate: Estimate;
  /** How many claims contributed an authoritative cost figure (honesty: the rest are null). */
  claimsWithAuthoritativeCost: number;
  /**
   * Total USD SAVED by cache hits (skill §8 "a hit is worth the counterfactual tier cost it
   * avoided"). Each hit is valued at the mean authoritative cost observed for the tier role it
   * short-circuited (`cacheAvoidedTierRole`). Null (not 0) when no authoritative tier cost was
   * ever seen — i.e. fixtures carry no usage, so the value is honestly unknown, never faked.
   */
  cacheAvoidedCostUsd: number | null;
}

/**
 * Accumulates decision records and emitted spans, then computes the five metrics keyed
 * (corpus, mode). One recorder per harness run; call `record()` per claim and `report()`
 * per (corpus, mode) partition.
 */
export class EconomicsRecorder {
  private readonly records: ClaimDecisionRecord[] = [];
  private readonly spans: GenAiCallSpan[] = [];

  record(record: ClaimDecisionRecord): void {
    this.records.push(record);
  }

  emitSpan(span: GenAiCallSpan): void {
    this.spans.push(span);
  }

  allSpans(): readonly GenAiCallSpan[] {
    return this.spans;
  }

  allRecords(): readonly ClaimDecisionRecord[] {
    return this.records;
  }

  /** Distinct (corpus, mode) partitions seen — the harness iterates these. */
  partitions(): { corpus: string; mode: CascadeMode }[] {
    const seen = new Map<string, { corpus: string; mode: CascadeMode }>();
    for (const r of this.records) {
      const k = `${r.corpus}::${r.mode}`;
      if (!seen.has(k)) seen.set(k, { corpus: r.corpus, mode: r.mode });
    }
    return [...seen.values()];
  }

  report(corpus: string, mode: CascadeMode): EconomicsReport {
    const rows = this.records.filter((r) => r.corpus === corpus && r.mode === mode);
    const n = rows.length;

    const hits = rows.filter((r) => r.cacheHit).length;
    const abstentions = rows.filter((r) => r.finalVerdict === "abstained").length;

    // β = escalation rate: share of claims that REACHED the escalation tier (a span was
    // emitted for that role on the claim's ref), NOT merely those DECIDED there — a claim can
    // reach escalation and still end abstained. Reaching escalation is what drives the
    // frontier cost, so β must count reach, per its own SLO definition (skill §8). Cache hits
    // never run a tier, so they cannot reach escalation.
    const escalationRefs = new Set<string>();
    for (const s of this.spans) {
      if (s.corpus === corpus && s.mode === mode && s.tier === "escalation") {
        escalationRefs.add(s.ref);
      }
    }
    const escalations = rows.filter((r) => !r.cacheHit && escalationRefs.has(r.ref)).length;

    // Cost per VERIFIED (decisive) claim. Only claims with an authoritative cost contribute
    // to the cost figure; the count of contributing claims is reported for honesty.
    const costed = rows.filter((r) => r.costUsd !== null);
    const costs = costed.map((r) => r.costUsd!);
    const costEstimate = meanEstimate(costs);

    const tierDistribution: Record<string, number> = {};
    for (const r of rows) {
      const bucket = r.cacheHit ? "cache" : (r.decidingTierRole ?? "abstained_past_all_tiers");
      tierDistribution[bucket] = (tierDistribution[bucket] ?? 0) + 1;
    }
    for (const k of Object.keys(tierDistribution)) {
      tierDistribution[k] = n > 0 ? tierDistribution[k]! / n : 0;
    }

    const latencyPerTierMs = meanLatencyPerTier(rows);

    // Cache-hit valuation (skill §8): value each hit at the mean AUTHORITATIVE cost seen for
    // the tier role it avoided. Build per-role mean cost from real (non-fixture, cost-bearing)
    // spans; if a role has no authoritative cost (all fixtures), a hit avoiding it contributes
    // nothing measurable, and if NO role ever had a cost the total stays null (honest unknown).
    const roleCosts = new Map<string, { sum: number; n: number }>();
    for (const s of this.spans) {
      if (s.corpus !== corpus || s.mode !== mode || s.cost_usd === null) continue;
      const agg = roleCosts.get(s.tier) ?? { sum: 0, n: 0 };
      agg.sum += s.cost_usd;
      agg.n += 1;
      roleCosts.set(s.tier, agg);
    }
    let cacheAvoidedCostUsd: number | null = roleCosts.size > 0 ? 0 : null;
    if (cacheAvoidedCostUsd !== null) {
      for (const r of rows) {
        if (!r.cacheHit || r.cacheAvoidedTierRole === null) continue;
        const agg = roleCosts.get(r.cacheAvoidedTierRole);
        if (agg && agg.n > 0) cacheAvoidedCostUsd += agg.sum / agg.n;
      }
    }

    return {
      corpus,
      mode,
      claims: n,
      costPerVerifiedClaim: costEstimate,
      cacheHitRate: proportionEstimate(hits, n),
      tierDistribution,
      abstentionRate: proportionEstimate(abstentions, n),
      latencyPerTierMs,
      escalationRate: proportionEstimate(escalations, n),
      claimsWithAuthoritativeCost: costed.length,
      cacheAvoidedCostUsd,
    };
  }
}

/** Mean + SE (naive, non-clustered) for a set of per-claim numeric values. */
export function meanEstimate(values: number[]): Estimate {
  const n = values.length;
  if (n === 0) return { value: 0, se: 0, ci95: 0, n: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(variance / n);
  return { value: mean, se, ci95: 1.96 * se, n };
}

/** Proportion + normal-approx SE for a k-of-n success count. */
export function proportionEstimate(k: number, n: number): Estimate {
  if (n === 0) return { value: 0, se: 0, ci95: 0, n: 0 };
  const p = k / n;
  const se = Math.sqrt((p * (1 - p)) / n);
  return { value: p, se, ci95: 1.96 * se, n };
}

/**
 * Cluster-robust SE for a proportion when claims share a source document (skill §7: per-doc
 * claim clusters can inflate naive SEs ~3×). Uses the cluster-sum estimator: variance of the
 * per-cluster success totals, scaled. `clusters` maps each observation to its source-doc id.
 */
export function clusteredProportionEstimate(
  successes: boolean[],
  clusterIds: string[],
): Estimate {
  const n = successes.length;
  if (n !== clusterIds.length) {
    throw new Error("clusteredProportionEstimate: length mismatch");
  }
  if (n === 0) return { value: 0, se: 0, ci95: 0, n: 0 };
  const k = successes.filter(Boolean).length;
  const p = k / n;

  // Group residuals (x_i - p) by cluster and sum within cluster (Liang-Zeger sandwich core).
  const byCluster = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const resid = (successes[i] ? 1 : 0) - p;
    byCluster.set(clusterIds[i]!, (byCluster.get(clusterIds[i]!) ?? 0) + resid);
  }
  let sumSq = 0;
  for (const s of byCluster.values()) sumSq += s * s;
  const m = byCluster.size;
  // Var(p̂) ≈ (m/(m-1)) · Σ_c (Σ_i resid)² / n²  — cluster-robust, reduces to naive when m=n.
  const finite = m > 1 ? m / (m - 1) : 1;
  const variance = (finite * sumSq) / (n * n);
  const se = Math.sqrt(Math.max(variance, 0));
  return { value: p, se, ci95: 1.96 * se, n };
}

function meanLatencyPerTier(
  rows: ClaimDecisionRecord[],
): Partial<Record<CascadeTierRole, number>> {
  const sums = new Map<CascadeTierRole, { total: number; count: number }>();
  for (const r of rows) {
    for (const [role, ms] of Object.entries(r.perTierLatencyMs) as [CascadeTierRole, number][]) {
      const agg = sums.get(role) ?? { total: 0, count: 0 };
      agg.total += ms;
      agg.count += 1;
      sums.set(role, agg);
    }
  }
  const out: Partial<Record<CascadeTierRole, number>> = {};
  for (const [role, agg] of sums) out[role] = agg.count > 0 ? agg.total / agg.count : 0;
  return out;
}
