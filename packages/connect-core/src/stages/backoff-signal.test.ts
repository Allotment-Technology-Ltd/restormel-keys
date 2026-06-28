import { describe, expect, it } from "vitest";
import {
  classifyBackoffReason,
  isRateLimitBackoffReason,
  isIngestBackoffReasonCode,
  computeBackoffDelayMs,
  backoffSignalToStageState,
  parseStageBackoff,
  type IngestBackoffSignal,
} from "./backoff-signal.js";

describe("classifyBackoffReason", () => {
  it("maps 429 / rate-limit / quota / resource-exhausted to rate_limit", () => {
    expect(classifyBackoffReason("HTTP 429 Too Many Requests")).toBe("rate_limit");
    expect(classifyBackoffReason("Error: rate limit exceeded")).toBe("rate_limit");
    expect(classifyBackoffReason("rate_limit_error")).toBe("rate_limit");
    expect(classifyBackoffReason("You have exceeded your quota")).toBe("rate_limit");
    expect(classifyBackoffReason("RESOURCE_EXHAUSTED: try later")).toBe("rate_limit");
    expect(classifyBackoffReason("Too Many Requests")).toBe("rate_limit");
  });

  it("maps 529 / overloaded to overloaded", () => {
    expect(classifyBackoffReason("HTTP 529")).toBe("overloaded");
    expect(classifyBackoffReason("Anthropic: Overloaded")).toBe("overloaded");
  });

  it("maps 5xx to server_error", () => {
    expect(classifyBackoffReason("HTTP 500 Internal Server Error")).toBe("server_error");
    expect(classifyBackoffReason("502 Bad Gateway")).toBe("server_error");
    expect(classifyBackoffReason("503 Service Unavailable")).toBe("server_error");
    expect(classifyBackoffReason("504 Gateway Timeout")).toBe("server_error");
  });

  it("maps timeouts to timeout", () => {
    expect(classifyBackoffReason("request timeout after 180000ms")).toBe("timeout");
    expect(classifyBackoffReason("The operation timed out")).toBe("timeout");
  });

  it("maps oversized context to context_length", () => {
    expect(classifyBackoffReason("prompt_too_long")).toBe("context_length");
    expect(classifyBackoffReason("maximum context_length exceeded")).toBe("context_length");
  });

  it("returns null for non-transient / hard failures", () => {
    expect(classifyBackoffReason("401 Unauthorized")).toBeNull();
    expect(classifyBackoffReason("model_not_found")).toBeNull();
    expect(classifyBackoffReason("invalid api key")).toBeNull();
    expect(classifyBackoffReason("")).toBeNull();
    expect(classifyBackoffReason(null)).toBeNull();
    expect(classifyBackoffReason(undefined)).toBeNull();
  });

  it("prefers the rate-limit family over a co-occurring 500", () => {
    // A '429' inside a message that also mentions 500 must still read as rate_limit.
    expect(classifyBackoffReason("429 rate limited (was 500 earlier)")).toBe("rate_limit");
  });
});

describe("isRateLimitBackoffReason", () => {
  it("is true only for genuine throttling (lights the amber banner)", () => {
    expect(isRateLimitBackoffReason("rate_limit")).toBe(true);
    expect(isRateLimitBackoffReason("overloaded")).toBe(true);
    expect(isRateLimitBackoffReason("server_error")).toBe(false);
    expect(isRateLimitBackoffReason("timeout")).toBe(false);
    expect(isRateLimitBackoffReason("context_length")).toBe(false);
  });
});

describe("isIngestBackoffReasonCode", () => {
  it("guards the persisted reason code", () => {
    expect(isIngestBackoffReasonCode("rate_limit")).toBe(true);
    expect(isIngestBackoffReasonCode("overloaded")).toBe(true);
    expect(isIngestBackoffReasonCode("nonsense")).toBe(false);
    expect(isIngestBackoffReasonCode(undefined)).toBe(false);
    expect(isIngestBackoffReasonCode(42)).toBe(false);
  });
});

describe("computeBackoffDelayMs", () => {
  it("is a capped exponential, 1-based", () => {
    expect(computeBackoffDelayMs(1)).toBe(1000);
    expect(computeBackoffDelayMs(2)).toBe(2000);
    expect(computeBackoffDelayMs(3)).toBe(4000);
    expect(computeBackoffDelayMs(4)).toBe(8000);
    // Capped at 8000 by default.
    expect(computeBackoffDelayMs(10)).toBe(8000);
  });

  it("honours custom base/max", () => {
    expect(computeBackoffDelayMs(1, { baseMs: 250, maxMs: 1000 })).toBe(250);
    expect(computeBackoffDelayMs(5, { baseMs: 250, maxMs: 1000 })).toBe(1000);
  });

  it("clamps non-positive attempts to attempt 1", () => {
    expect(computeBackoffDelayMs(0)).toBe(1000);
    expect(computeBackoffDelayMs(-3)).toBe(1000);
  });
});

describe("backoffSignalToStageState / parseStageBackoff round-trip", () => {
  const signal: IngestBackoffSignal = {
    stage: "extraction",
    provider: "anthropic",
    model: "claude-x",
    reason_code: "rate_limit",
    attempt: 2,
    max_attempts: 4,
    delay_ms: 2000,
    at: "2026-06-28T10:00:00.000Z",
  };

  it("projects the in-flight signal down to the persisted shape", () => {
    expect(backoffSignalToStageState(signal)).toEqual({
      reason_code: "rate_limit",
      attempt: 2,
      delay_ms: 2000,
      at: "2026-06-28T10:00:00.000Z",
    });
  });

  it("parses back the persisted shape", () => {
    const state = backoffSignalToStageState(signal);
    expect(parseStageBackoff(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("rejects malformed / unknown-reason persisted values", () => {
    expect(parseStageBackoff(null)).toBeNull();
    expect(parseStageBackoff("rate_limit")).toBeNull();
    expect(parseStageBackoff({ reason_code: "made_up", attempt: 1, delay_ms: 0 })).toBeNull();
  });

  it("coerces out-of-range numerics defensively", () => {
    const parsed = parseStageBackoff({
      reason_code: "overloaded",
      attempt: -5,
      delay_ms: Number.NaN,
    });
    expect(parsed).toEqual({
      reason_code: "overloaded",
      attempt: 1,
      delay_ms: 0,
      at: new Date(0).toISOString(),
    });
  });
});
