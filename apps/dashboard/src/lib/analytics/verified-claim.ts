/**
 * Phase 3 north-metric instrumentation: the verified-claim → source-span click.
 *
 * Encapsulates the falsifiability event so the Prove UI just calls one function.
 * Captures only NON-PII ids/enums/buckets — never the claim text, source title,
 * trust score, or the user's question.
 */
import { browser } from "$app/environment";
import { track } from "$lib/analytics/track";
import type { TrustBucket } from "$lib/analytics/events";
import type { ProvenanceClaim } from "$lib/connect/graph-comparison-types";

/** Must match FirstRunOnboarding.svelte's ONBOARDING_COMPLETE_STORAGE_KEY. */
const ONBOARDING_COMPLETE_STORAGE_KEY = "restormel_onboarding_complete";

/** A session is "first-run" until the user has completed onboarding. */
export function isFirstRunSession(): boolean {
  if (!browser) return false;
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY) !== "true";
  } catch {
    // Storage blocked (private mode / denied) — treat as first-run, don't crash.
    return true;
  }
}

/** Coarse, PII-free bucket of a 0–100 trust score (raw score is never sent). */
export function trustBucket(score: number | null | undefined): TrustBucket {
  if (score == null || Number.isNaN(score)) return "unscored";
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

/**
 * Fire the Phase 3 north metric when a user clicks a verified claim through to
 * its source span. Safe to call from any claim render site (SSR/crash-safe via
 * `track`). `workspaceId` is the opaque scoping id; pass null when unavailable.
 */
export function captureVerifiedClaimSourceSpanOpened(args: {
  claim: ProvenanceClaim;
  workspaceId: string | null;
  surface?: string;
}): void {
  track("verified_claim_source_span_opened", {
    workspace_id: args.workspaceId ?? "anon",
    claim_id: args.claim.id,
    verification: args.claim.verification,
    trust_bucket: trustBucket(args.claim.trustScore),
    is_first_run: isFirstRunSession(),
    surface: args.surface ?? "prove_console",
  });
}
