/**
 * RES-113 PR-I — structured backoff / rate-limit signal for ingest runs.
 *
 * The ingest engine (model-call.ts and the host's route executor) previously only
 * `console.log`-ed `[RETRY]` when a provider returned a transient error. This module
 * defines a STRUCTURED signal so a real backoff can flow engine → job-record → SSE →
 * the M1 run console's amber "provider rate-limited" state (REC-ADR-016: honest,
 * visible pipeline states — never a fabricated one).
 *
 * Pure + dependency-free: no DB, no network, no timers. The classifier is the single
 * source of truth for "is this error transient/retryable?" so model-call.ts and the
 * live route executor agree on what counts as backoff (and the unit tests pin it).
 */

/**
 * Why a provider call is backing off. `null` (from {@link classifyBackoffReason})
 * means the error is NOT transient — a hard failure that must surface, not retry.
 */
export type IngestBackoffReasonCode =
  | "rate_limit" // 429 / quota / too many requests / resource exhausted
  | "overloaded" // 529 / explicitly overloaded
  | "server_error" // 500 / 502 / 503 / 504 — transient upstream fault
  | "timeout" // request timed out
  | "context_length"; // prompt_too_long / context_length — retried by trimming/repair upstream

/** The structured signal the engine emits when it backs off before a retry. */
export type IngestBackoffSignal = {
  /** Engine stage key (a model stage like `extraction`, or a pipeline stage). */
  stage: string;
  /** Resolved provider for the failing call, when known. */
  provider?: string;
  /** Resolved model id for the failing call, when known. */
  model?: string;
  reason_code: IngestBackoffReasonCode;
  /** 1-based index of the upcoming retry attempt (the attempt being backed-off into). */
  attempt: number;
  /** Total attempts the engine will make for this logical call, when known. */
  max_attempts?: number;
  /** Backoff delay applied before the retry, in ms (0 when the engine fails over without sleeping). */
  delay_ms: number;
  /** ISO timestamp the signal was raised. */
  at: string;
};

/**
 * The serialisable subset persisted onto a job's stage row (`ConnectIngestStageProgress.backoff`).
 * Kept minimal so it survives the JSONB round-trip + `normalizeConnectIngestStages` and is cheap
 * to stream over SSE. The console lights amber from this — see `isM1StageBackingOff`.
 */
export type ConnectIngestStageBackoff = {
  reason_code: IngestBackoffReasonCode;
  attempt: number;
  delay_ms: number;
  at: string;
};

/** Function the engine calls to publish a backoff signal (best-effort; must never throw upward). */
export type IngestBackoffEmitter = (signal: IngestBackoffSignal) => void;

const ALL_REASON_CODES: ReadonlySet<string> = new Set<IngestBackoffReasonCode>([
  "rate_limit",
  "overloaded",
  "server_error",
  "timeout",
  "context_length",
]);

/**
 * Classify an upstream error message into a backoff reason, or `null` when the error
 * is NOT transient (a hard failure: auth, bad request, model-not-found, …). This is the
 * single retryability oracle — model-call.ts's retry loop and the live route executor
 * both gate on a non-null result.
 *
 * Ordering matters: the most specific / "rate-limit-shaped" matches win so the amber
 * state (see {@link isRateLimitBackoffReason}) is accurate.
 */
export function classifyBackoffReason(
  message: string | null | undefined,
): IngestBackoffReasonCode | null {
  if (!message) return null;
  const msg = message;
  const lower = msg.toLowerCase();

  // Rate-limit family — 429, quota, "too many requests", Vertex "resource exhausted".
  if (
    msg.includes("429") ||
    /rate[\s_-]?limit/i.test(msg) ||
    /too many requests/i.test(msg) ||
    /\bquota\b/i.test(msg) ||
    /resource[\s_-]?exhausted/i.test(msg)
  ) {
    return "rate_limit";
  }

  // Provider-overloaded — Anthropic 529 / explicit "overloaded".
  if (msg.includes("529") || lower.includes("overloaded")) {
    return "overloaded";
  }

  // Transient server faults — 5xx.
  if (
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  ) {
    return "server_error";
  }

  // Timeouts.
  if (lower.includes("timeout") || /timed out/i.test(msg)) {
    return "timeout";
  }

  // Oversized prompt / context window — retryable by upstream trimming or JSON repair.
  if (lower.includes("prompt_too_long") || lower.includes("context_length")) {
    return "context_length";
  }

  return null;
}

/**
 * True when a backoff reason should light the M1 console's amber "Provider rate-limited"
 * banner. Only genuine throttling (rate_limit / overloaded) earns that copy; plain 5xx /
 * timeout retries are transient but are NOT a rate-limit, so they retry quietly rather
 * than mislabel the provider as throttling (REC-ADR-016 — name the real state).
 */
export function isRateLimitBackoffReason(reason: IngestBackoffReasonCode): boolean {
  return reason === "rate_limit" || reason === "overloaded";
}

/** Type guard for a persisted reason code (defends the JSONB read path). */
export function isIngestBackoffReasonCode(value: unknown): value is IngestBackoffReasonCode {
  return typeof value === "string" && ALL_REASON_CODES.has(value);
}

/**
 * Capped exponential backoff delay for the upcoming retry `attempt` (1-based).
 * Mirrors model-call.ts's historical `1000 * 2^(attempt-1)` curve but bounded so a
 * deep fallback chain can't sleep for minutes. Deterministic (no jitter) so it is unit-testable.
 */
export function computeBackoffDelayMs(
  attempt: number,
  opts?: { baseMs?: number; maxMs?: number },
): number {
  const baseMs = opts?.baseMs ?? 1000;
  const maxMs = opts?.maxMs ?? 8000;
  const n = Math.max(1, Math.floor(attempt));
  const raw = baseMs * 2 ** (n - 1);
  return Math.min(maxMs, Math.max(0, raw));
}

/** Project a full in-flight signal down to the persisted stage-row shape. */
export function backoffSignalToStageState(signal: IngestBackoffSignal): ConnectIngestStageBackoff {
  return {
    reason_code: signal.reason_code,
    attempt: Math.max(1, Math.floor(signal.attempt)),
    delay_ms: Math.max(0, Math.floor(signal.delay_ms)),
    at: signal.at,
  };
}

/** Parse an untrusted JSONB value into a stage-backoff state, or `null` if malformed. */
export function parseStageBackoff(raw: unknown): ConnectIngestStageBackoff | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (!isIngestBackoffReasonCode(rec.reason_code)) return null;
  const attempt = Number(rec.attempt);
  const delayMs = Number(rec.delay_ms);
  return {
    reason_code: rec.reason_code,
    attempt: Number.isFinite(attempt) ? Math.max(1, Math.round(attempt)) : 1,
    delay_ms: Number.isFinite(delayMs) ? Math.max(0, Math.round(delayMs)) : 0,
    at: typeof rec.at === "string" ? rec.at : new Date(0).toISOString(),
  };
}
