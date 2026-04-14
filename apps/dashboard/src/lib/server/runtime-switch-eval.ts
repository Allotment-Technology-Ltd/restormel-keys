/**
 * Phase 3: allowlisted server-side evaluation for hosted runtime — when an upstream
 * OpenAI-compatible call fails, decide whether to advance to the next route step using
 * `fallbackOn` and optional `switchCriteria.advanceOn` (intersection with allowlist only).
 */
import type { RouteStepRecord } from "$lib/server/db";
import type { OpenAiChatFailure } from "$lib/server/runtime-openai-chat";

/** Versioned together with runtime contract (see resolve-response RUNTIME_INVOKE_CONTRACT_VERSION). */
export const RUNTIME_SWITCH_EVAL_VERSION = "2026-06-01";

/** Normalised failure kinds aligned with route step `fallbackOn` vocabulary (steps API). */
export type HostedFailureKind = "error" | "rate_limit" | "no_key" | "policy_block" | "any";

const ADVANCE_ON_ALLOWLIST = new Set<string>(["error", "rate_limit", "no_key", "policy_block", "any"]);

/** Map upstream failure to a single kind for fallback matching. */
export function classifyUpstreamFailure(failure: OpenAiChatFailure): HostedFailureKind {
  const http = failure.httpStatus;
  if (http === 429) return "rate_limit";
  if (failure.message === "upstream_timeout" || failure.message.includes("timeout")) return "error";
  if (failure.errorCode === "upstream_invalid_json" || failure.errorCode === "upstream_missing_content") {
    return "error";
  }
  if (http >= 500 && http < 600) return "error";
  if (http >= 400 && http < 500) return "error";
  if (http === 0) return "error";
  return "error";
}

function fallbackOnMatches(fallbackOn: string | null | undefined, kind: HostedFailureKind): boolean {
  const f = fallbackOn ?? "error";
  if (f === "any") return true;
  if (f === kind) return true;
  return false;
}

/**
 * Whether the pipeline should try the next enabled step after this upstream failure.
 * - Uses `switchCriteria.advanceOn` when present: only **allowlisted** strings are honoured;
 *   if the array is non-empty after filtering, failure must match one of them (or `any`).
 * - Otherwise uses column `fallbackOn` on the step.
 */
export function shouldAdvanceAfterUpstreamFailure(
  step: RouteStepRecord,
  kind: HostedFailureKind
): boolean {
  const sc = step.switchCriteria;
  if (sc && typeof sc === "object" && sc !== null && "advanceOn" in sc) {
    const raw = (sc as { advanceOn?: unknown }).advanceOn;
    if (Array.isArray(raw) && raw.length > 0) {
      const filtered = raw.filter(
        (x): x is string => typeof x === "string" && ADVANCE_ON_ALLOWLIST.has(x)
      );
      if (filtered.length > 0) {
        return filtered.includes("any") || filtered.includes(kind);
      }
    }
  }
  return fallbackOnMatches(step.fallbackOn, kind);
}

/** Documented allowlist for `advanceOn` entries (for simulate / OpenAPI). */
export function getAdvanceOnAllowlist(): readonly string[] {
  return Array.from(ADVANCE_ON_ALLOWLIST).sort();
}

const MATRIX_KINDS: HostedFailureKind[] = ["error", "rate_limit", "no_key", "policy_block"];

/** Dry-run matrix for simulate: would hosted runtime advance to the next step after this failure kind? */
export function hostedSwitchAdvanceMatrix(
  step: RouteStepRecord
): Record<HostedFailureKind, boolean> {
  const out: Partial<Record<HostedFailureKind, boolean>> = {};
  for (const k of MATRIX_KINDS) {
    out[k] = shouldAdvanceAfterUpstreamFailure(step, k);
  }
  out.any = shouldAdvanceAfterUpstreamFailure(step, "any");
  return out as Record<HostedFailureKind, boolean>;
}
