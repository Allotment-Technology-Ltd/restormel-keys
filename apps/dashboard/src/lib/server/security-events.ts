/**
 * Structured security-event emitter for PostHog.
 *
 * Each named event mirrors a call site (auth failure, admin action, rate-limit,
 * webhook-signature failure, credential resolve, ingest error) and emits a
 * bounded, opaque PostHog event so dashboards/alerts can track security-relevant
 * activity without logging secrets, PII, payloads, or credentials.
 *
 * Redaction contract (enforced here, not by callers):
 *   - Never capture: raw API keys, provider credentials, ciphertext/IV/tags,
 *     webhook secrets, HMAC values, user message bodies, free-text error details
 *     that may echo request/response bodies, or email addresses.
 *   - Allowed: opaque workspace/actor/project/key IDs truncated to prefix,
 *     event type tokens, status codes, boolean flags.
 *
 * Volume bounding:
 *   - High-frequency events (rate_limit_hit, auth_failure) are sampled in-process
 *     via a token-bucket: at most SECURITY_EVENT_BURST_CAP emissions per
 *     SECURITY_EVENT_WINDOW_MS per (event, bucketKey) pair. The cap is low
 *     (default 10/60s) so a sudden burst of 401s from one key can't become a
 *     cost runaway in PostHog.
 *   - Low-frequency events (admin action, ingest error) are not rate-limited
 *     because they are inherently infrequent.
 *   - All emits are fire-and-forget; capture never blocks the caller.
 *
 * Env guard:
 *   - No-ops entirely if POSTHOG_API_KEY / PUBLIC_POSTHOG_KEY is unset (local dev).
 */

import { captureServerPostHogEvent } from "./posthog-capture.js";

// ---------------------------------------------------------------------------
// Volume-bounding: per-(event,bucket) token-bucket limiter
// ---------------------------------------------------------------------------

const SECURITY_EVENT_WINDOW_MS = 60_000; // 60 s rolling window
const SECURITY_EVENT_BURST_CAP = 10; // max emits per window per bucket

type BucketState = {
  count: number;
  windowStart: number;
};

// Module-level map; lives in the Node process. Never persisted — resets on restart.
const _buckets = new Map<string, BucketState>();

/**
 * Returns true if we should emit this event, false if it has been sampled out.
 * The eventName + bucketKey pair gets its own sliding-window counter.
 */
function shouldEmit(eventName: string, bucketKey: string): boolean {
  const key = `${eventName}:${bucketKey}`;
  const now = Date.now();
  let bucket = _buckets.get(key);
  if (!bucket || now - bucket.windowStart > SECURITY_EVENT_WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    _buckets.set(key, bucket);
  }
  if (bucket.count >= SECURITY_EVENT_BURST_CAP) return false;
  bucket.count++;
  return true;
}

/** Prune stale buckets every ~5 min to prevent unbounded map growth. */
let _lastPruneAt = 0;
function maybePruneBuckets(): void {
  const now = Date.now();
  if (now - _lastPruneAt < 5 * 60_000) return;
  _lastPruneAt = now;
  for (const [key, b] of _buckets) {
    if (now - b.windowStart > SECURITY_EVENT_WINDOW_MS * 2) _buckets.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Safe ID helpers
// ---------------------------------------------------------------------------

/** Truncate an opaque ID to at most 12 chars — safe for PostHog properties. */
function safeId(id: string | null | undefined, prefix = ""): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  return prefix ? `${prefix}_${trimmed.slice(0, 12)}` : trimmed.slice(0, 12);
}

// ---------------------------------------------------------------------------
// Core emit helper
// ---------------------------------------------------------------------------

function emit(
  eventName: string,
  distinctId: string,
  props: Record<string, string | number | boolean | null>,
): void {
  // Guard: no PostHog key → silent no-op (local dev / test environments).
  const apiKey = process.env.POSTHOG_API_KEY ?? process.env.PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  maybePruneBuckets();

  // Fire-and-forget — never await in hot paths.
  void captureServerPostHogEvent(distinctId, eventName, {
    ...props,
    $lib: "restormel-security-events",
  });
}

// ---------------------------------------------------------------------------
// Named security events
// ---------------------------------------------------------------------------

/**
 * Auth failure — bearer key rejected, session missing, or verification error.
 *
 * Volume-bounded: at most SECURITY_EVENT_BURST_CAP per window per actor bucket.
 *
 * @param actorBucket  Opaque key prefix or partial user ID (≤12 chars) — not a full key.
 * @param reason       One of: "invalid_key" | "session_missing" | "verification_error"
 * @param path         Request pathname or full URL; query string is stripped defensively.
 * @param status       HTTP status that will be returned (401 / 403).
 */
export function emitAuthFailure(params: {
  actorBucket: string;
  reason: "invalid_key" | "session_missing" | "verification_error";
  path: string;
  status: 401 | 403;
}): void {
  const bucket = safeId(params.actorBucket) ?? "unknown";
  if (!shouldEmit("security_auth_failure", bucket)) return;
  // Strip query string and fragment defensively — they may contain tokens.
  const safePath = params.path.split("?")[0].split("#")[0].slice(0, 120);
  emit("security_auth_failure", `bucket_${bucket}`, {
    reason: params.reason,
    path: safePath,
    status: params.status,
  });
}

/**
 * Admin action — mirrors an audit_events write so the event appears in PostHog
 * Insights/Alerts without duplicating the DB table.
 *
 * Only opaque IDs; no summary text (may contain sensitive context).
 * Not rate-limited because admin actions are inherently infrequent.
 *
 * @param workspaceId  Workspace owning the action (prefix used).
 * @param actorId      Actor's opaque UID (prefix used).
 * @param eventType    The audit_events.event_type token (e.g. "gateway_key_created").
 * @param targetType   The audit_events.target_type token (e.g. "gateway_key").
 */
export function emitAdminAction(params: {
  workspaceId: string;
  actorId: string;
  eventType: string;
  targetType: string;
}): void {
  const distinctId = `ws_${params.workspaceId.slice(0, 8)}`;
  emit("security_admin_action", distinctId, {
    event_type: params.eventType.slice(0, 80),
    target_type: params.targetType.slice(0, 40),
    actor_prefix: safeId(params.actorId),
    workspace_prefix: safeId(params.workspaceId),
  });
}

/**
 * Rate-limit hit — client exceeded a per-key or per-IP window.
 *
 * Volume-bounded per (limitKey, path) bucket.
 *
 * @param limitKey   Opaque rate-limit bucket identifier (key prefix or IP hash).
 * @param path       Affected endpoint path.
 * @param limitType  "memory_write" | "gateway_key" | "session_start" | "other".
 */
export function emitRateLimitHit(params: {
  limitKey: string;
  path: string;
  limitType: "memory_write" | "gateway_key" | "session_start" | "other";
}): void {
  const bucket = safeId(params.limitKey) ?? "unknown";
  if (!shouldEmit("security_rate_limit_hit", bucket)) return;
  // Strip query string and fragment defensively.
  const safePath = params.path.split("?")[0].split("#")[0].slice(0, 120);
  emit("security_rate_limit_hit", `ratelimit_${bucket}`, {
    limit_type: params.limitType,
    path: safePath,
  });
}

/**
 * Webhook signature failure — incoming webhook body did not match expected HMAC.
 *
 * Do NOT pass the expected or received HMAC, the signing secret, or any body excerpt.
 * Volume-bounded per endpoint prefix.
 *
 * @param endpointPrefix  Opaque prefix of the receiving endpoint (first 12 chars of ID).
 * @param eventType       The claimed X-Webhook-Event header value.
 */
export function emitWebhookSigFailure(params: {
  endpointPrefix: string;
  eventType: string;
}): void {
  const bucket = safeId(params.endpointPrefix) ?? "unknown";
  if (!shouldEmit("security_webhook_sig_failure", bucket)) return;
  emit("security_webhook_sig_failure", `whk_${bucket}`, {
    event_type: params.eventType.slice(0, 80),
  });
}

/**
 * Credential resolve call — a hosted-credentials resolve endpoint was invoked.
 *
 * Captures only the provider type and whether the call succeeded; never the
 * resolved key, ciphertext, or any part of the provider credential.
 *
 * Volume-bounded per workspace+provider bucket.
 *
 * @param workspaceId  Workspace ID (prefix used).
 * @param providerType Canonical provider token (e.g. "openai", "anthropic").
 * @param success      Whether the resolve returned a usable credential.
 */
export function emitCredentialResolve(params: {
  workspaceId: string;
  providerType: string;
  success: boolean;
}): void {
  const bucket = `${params.workspaceId.slice(0, 8)}_${params.providerType.slice(0, 20)}`;
  if (!shouldEmit("security_credential_resolve", bucket)) return;
  emit("security_credential_resolve", `ws_${params.workspaceId.slice(0, 8)}`, {
    provider_type: params.providerType.slice(0, 40),
    success: params.success,
  });
}

/**
 * Ingest error — a Connect ingest job failed (worker error, validation, upstream 5xx).
 *
 * Never logs job payloads, provider responses, or raw error messages (may echo API bodies).
 * Volume-bounded per workspace.
 *
 * @param workspaceId  Workspace owning the ingest job (prefix used).
 * @param errorClass   "validation" | "worker_crash" | "upstream_error" | "unknown".
 * @param jobType      Ingest job type token (e.g. "connect_ingest", "graph_import").
 */
export function emitIngestError(params: {
  workspaceId: string;
  errorClass: "validation" | "worker_crash" | "upstream_error" | "unknown";
  jobType: string;
}): void {
  const bucket = params.workspaceId.slice(0, 8);
  if (!shouldEmit("security_ingest_error", bucket)) return;
  emit("security_ingest_error", `ws_${bucket}`, {
    error_class: params.errorClass,
    job_type: params.jobType.slice(0, 40),
  });
}
