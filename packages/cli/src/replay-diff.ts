/**
 * Pure replay/compare logic for `keys replay` (Stage 4D). No I/O — unit-testable.
 *
 * Compares the claims a query returned when its ProvenanceTrace was recorded against the claims
 * the same query returns now (re-run with the same verification policy, depth, and token budget),
 * classifying each as STABLE, CHANGED (verification changed or REMOVED), or NEW.
 */
import type { ProvenanceTrace } from "@restormel/contracts/provenance-trace";
import type {
  ConnectGraphOpRequest,
  ConnectGraphOpResponse,
  ConnectGraphVerificationPolicy,
} from "@restormel/contracts/connect";

/** A claim flattened to the fields replay compares. */
export interface ReplayClaim {
  claim_id: string;
  claim_text: string;
  verification_state: string | null;
  verification_category: string | null;
  trust_score: number | null;
  confidence_score: number | null;
}

export type ReplayStatus = "stable" | "changed" | "removed" | "new";

export interface ReplayClaimSnapshot {
  verification: string;
  verification_state: string | null;
  trust_score: number | null;
  confidence_score: number | null;
}

export interface ReplayClaimDiff {
  status: ReplayStatus;
  claim_id: string;
  text: string;
  original?: ReplayClaimSnapshot;
  current?: ReplayClaimSnapshot;
}

export interface ReplayCounts {
  stable: number;
  /** Includes REMOVED claims (matches the spec's "N changed" summary). */
  changed: number;
  removed: number;
  new: number;
  originalTotal: number;
  currentTotal: number;
}

export interface ReplayDiff {
  stable: ReplayClaimDiff[];
  /** Verification-changed and removed claims, in that order. */
  changed: ReplayClaimDiff[];
  added: ReplayClaimDiff[];
  counts: ReplayCounts;
  /** (changed + removed) / originalTotal. */
  driftRatio: number;
  /** True when more than half of the original claims changed (re-ingest / heavy edit signal). */
  significantDrift: boolean;
}

const VERIFICATION_CATEGORIES = ["supported", "weak", "unsupported"];

/** Stable identity for change detection: raw state if present, else category, else "unverified". */
function verificationIdentity(c: ReplayClaim): string {
  if (c.verification_state) return c.verification_state.toLowerCase();
  if (c.verification_category) return c.verification_category.toLowerCase();
  return "unverified";
}

/** Human display label (e.g. SUPPORTED, WEAK, VALIDATED). */
export function verificationLabel(c: ReplayClaim): string {
  return (c.verification_category ?? c.verification_state ?? "unverified").toUpperCase();
}

/** Best available score: trust score preferred, else seed/confidence score. */
export function replayScore(c: ReplayClaim): number | null {
  if (typeof c.trust_score === "number") return c.trust_score;
  if (typeof c.confidence_score === "number") return c.confidence_score;
  return null;
}

function snapshot(c: ReplayClaim): ReplayClaimSnapshot {
  return {
    verification: verificationLabel(c),
    verification_state: c.verification_state,
    trust_score: c.trust_score,
    confidence_score: c.confidence_score,
  };
}

/** The claims a trace actually surfaced to the agent (included only). */
export function originalClaimsFromTrace(trace: ProvenanceTrace): ReplayClaim[] {
  return trace.claims
    .filter((c) => c.included)
    .map((c) => ({
      claim_id: c.claim_id,
      claim_text: c.claim_text,
      verification_state: c.verification_state,
      verification_category: null,
      trust_score: c.trust_score,
      confidence_score: c.confidence_score,
    }));
}

/** The claims a fresh /connect/v1/graph response returned. */
export function currentClaimsFromResponse(response: ConnectGraphOpResponse): ReplayClaim[] {
  const claims = response.subgraph?.claims ?? [];
  return claims.map((c) => ({
    claim_id: c.id,
    claim_text: c.text,
    verification_state: c.verification_state ?? null,
    verification_category: c.verification_category ?? null,
    trust_score: typeof c.trust_score === "number" ? c.trust_score : null,
    confidence_score: typeof c.confidence === "number" ? c.confidence : null,
  }));
}

export function computeReplayDiff(original: ReplayClaim[], current: ReplayClaim[]): ReplayDiff {
  const currentById = new Map(current.map((c) => [c.claim_id, c]));
  const originalIds = new Set(original.map((c) => c.claim_id));

  const stable: ReplayClaimDiff[] = [];
  const changedVerification: ReplayClaimDiff[] = [];
  const removed: ReplayClaimDiff[] = [];
  const added: ReplayClaimDiff[] = [];

  for (const o of original) {
    const cur = currentById.get(o.claim_id);
    if (!cur) {
      removed.push({ status: "removed", claim_id: o.claim_id, text: o.claim_text, original: snapshot(o) });
      continue;
    }
    if (verificationIdentity(o) === verificationIdentity(cur)) {
      stable.push({ status: "stable", claim_id: o.claim_id, text: cur.claim_text, current: snapshot(cur) });
    } else {
      changedVerification.push({
        status: "changed",
        claim_id: o.claim_id,
        text: cur.claim_text,
        original: snapshot(o),
        current: snapshot(cur),
      });
    }
  }

  for (const c of current) {
    if (!originalIds.has(c.claim_id)) {
      added.push({ status: "new", claim_id: c.claim_id, text: c.claim_text, current: snapshot(c) });
    }
  }

  const changed = [...changedVerification, ...removed];
  const originalTotal = original.length;
  const driftRatio = originalTotal === 0 ? 0 : changed.length / originalTotal;

  return {
    stable,
    changed,
    added,
    counts: {
      stable: stable.length,
      changed: changed.length,
      removed: removed.length,
      new: added.length,
      originalTotal,
      currentTotal: current.length,
    },
    driftRatio,
    significantDrift: driftRatio > 0.5,
  };
}

/** Map a trace's recorded verification policy back onto a graph-op request policy. */
export function policyFromTrace(trace: ProvenanceTrace): ConnectGraphVerificationPolicy {
  const include = trace.verification_policy.included_states.filter((s) =>
    VERIFICATION_CATEGORIES.includes(s),
  ) as ConnectGraphVerificationPolicy["include"];
  return {
    include: include.length > 0 ? include : ["supported"],
    ...(trace.verification_policy.min_trust_score > 0
      ? { min_trust_score: trace.verification_policy.min_trust_score }
      : {}),
    ...(trace.verification_policy.excluded_flagged ? { exclude_flagged: true } : {}),
  };
}

/**
 * Rebuild the original query as a graph-op request: same query (or seeds), same policy, same
 * depth and token budget — so the replay re-runs it exactly as it ran.
 */
export function buildReplayRequest(
  trace: ProvenanceTrace,
  scope: { workspaceId: string; projectId?: string },
): ConnectGraphOpRequest {
  const policy = policyFromTrace(trace);
  const depth = trace.expansion[0]?.depth;
  const tokenBudget = trace.result.token_budget;
  const hasQuery = trace.query.trim().length > 0;

  const base = {
    workspace_id: scope.workspaceId,
    ...(scope.projectId ? { project_id: scope.projectId } : {}),
    ...(tokenBudget > 0 ? { max_tokens: tokenBudget } : {}),
    verification_policy: policy,
  };

  if (hasQuery) {
    return {
      ...base,
      operation: "retrieve_context",
      query: trace.query,
      ...(depth ? { max_depth: depth } : {}),
    };
  }
  return {
    ...base,
    operation: "expand_context",
    seed_node_ids: trace.seeds.map((s) => s.claim_id).filter((id) => id.length > 0),
    ...(depth ? { depth } : {}),
  };
}
