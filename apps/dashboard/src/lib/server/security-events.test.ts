/**
 * Unit tests for security-events.ts — verifies redaction, volume-bounding, and env-guard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We mock posthog-capture so we can assert what properties are sent without
// actually posting to PostHog.
vi.mock("./posthog-capture.js", () => ({
  captureServerPostHogEvent: vi.fn(),
  workspacePostHogDistinctId: (id: string) => `ws_${id.slice(0, 8)}`,
}));

import { captureServerPostHogEvent } from "./posthog-capture.js";
import {
  emitAuthFailure,
  emitAdminAction,
  emitRateLimitHit,
  emitWebhookSigFailure,
  emitCredentialResolve,
  emitIngestError,
} from "./security-events.js";

const mockCapture = captureServerPostHogEvent as ReturnType<typeof vi.fn>;

describe("security-events — env guard", () => {
  beforeEach(() => {
    delete process.env.POSTHOG_API_KEY;
    delete process.env.PUBLIC_POSTHOG_KEY;
    mockCapture.mockClear();
  });

  it("no-ops entirely when POSTHOG_API_KEY is unset", () => {
    emitAuthFailure({ actorBucket: "abc123", reason: "invalid_key", path: "/keys/v1/test", status: 401 });
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe("security-events — emitAuthFailure", () => {
  beforeEach(() => {
    process.env.POSTHOG_API_KEY = "phc_test";
    mockCapture.mockClear();
  });
  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
  });

  it("captures redacted auth failure with no key material", () => {
    emitAuthFailure({
      actorBucket: "sk-live-REAL_SECRET_KEY_NEVER_LOG_THIS",
      reason: "invalid_key",
      path: "/keys/v1/catalog?apiKey=sk-live-secret",
      status: 401,
    });
    expect(mockCapture).toHaveBeenCalledOnce();
    const [distinctId, eventName, props] = mockCapture.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(eventName).toBe("security_auth_failure");
    // distinct_id is a short opaque bucket prefix — never the full key
    expect(distinctId.length).toBeLessThanOrEqual(30);
    // Actor bucket is truncated to 12 chars — raw secret must not appear
    expect(JSON.stringify(props)).not.toContain("sk-live-REAL_SECRET");
    // Query string must be stripped from path
    expect(props.path).not.toContain("apiKey=");
    expect(props.path).toContain("/keys/v1/catalog");
    expect(props.reason).toBe("invalid_key");
    expect(props.status).toBe(401);
  });

  it("volume-bounds: caps repeated emits for the same bucket within the window", () => {
    for (let i = 0; i < 20; i++) {
      emitAuthFailure({ actorBucket: "same_bucket_cap_test", reason: "invalid_key", path: "/p", status: 401 });
    }
    // Should cap at SECURITY_EVENT_BURST_CAP (10) not 20
    expect(mockCapture.mock.calls.length).toBeLessThanOrEqual(10);
  });
});

describe("security-events — emitAdminAction", () => {
  beforeEach(() => {
    process.env.POSTHOG_API_KEY = "phc_test";
    mockCapture.mockClear();
  });
  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
  });

  it("captures admin action using only opaque IDs, no summary text", () => {
    emitAdminAction({
      workspaceId: "01234567-89ab-cdef-0123-456789abcdef",
      actorId: "user-uid-abc123",
      eventType: "gateway_key_created",
      targetType: "gateway_key",
    });
    expect(mockCapture).toHaveBeenCalledOnce();
    const [distinctId, eventName, props] = mockCapture.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(eventName).toBe("security_admin_action");
    expect(distinctId).toBe("ws_01234567");
    expect(props.event_type).toBe("gateway_key_created");
    expect(props.target_type).toBe("gateway_key");
    // actor_prefix is a short truncation — no full UID
    expect(String(props.actor_prefix).length).toBeLessThanOrEqual(12);
    // No "summary" field — would risk PII/context leakage
    expect("summary" in props).toBe(false);
  });
});

describe("security-events — emitRateLimitHit", () => {
  beforeEach(() => {
    process.env.POSTHOG_API_KEY = "phc_test";
    mockCapture.mockClear();
  });
  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
  });

  it("captures rate limit hit with limit_type and truncated path", () => {
    emitRateLimitHit({ limitKey: "keyid123", path: "/connect/v1/memory", limitType: "memory_write" });
    const [, eventName, props] = mockCapture.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(eventName).toBe("security_rate_limit_hit");
    expect(props.limit_type).toBe("memory_write");
    expect(props.path).toBe("/connect/v1/memory");
  });
});

describe("security-events — emitWebhookSigFailure", () => {
  beforeEach(() => {
    process.env.POSTHOG_API_KEY = "phc_test";
    mockCapture.mockClear();
  });
  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
  });

  it("captures webhook sig failure without HMAC or secret", () => {
    emitWebhookSigFailure({ endpointPrefix: "wh_endpoint_abc", eventType: "key.created" });
    const [, eventName, props] = mockCapture.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(eventName).toBe("security_webhook_sig_failure");
    expect(props.event_type).toBe("key.created");
    // Must not contain any HMAC-like value or secret
    const serialized = JSON.stringify(props);
    expect(serialized).not.toMatch(/hmac|secret|sig=/i);
  });
});

describe("security-events — emitCredentialResolve", () => {
  beforeEach(() => {
    process.env.POSTHOG_API_KEY = "phc_test";
    mockCapture.mockClear();
  });
  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
  });

  it("captures resolve call with provider type and success flag only", () => {
    emitCredentialResolve({ workspaceId: "ws-abcdef01-2345", providerType: "openai", success: true });
    const [, eventName, props] = mockCapture.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(eventName).toBe("security_credential_resolve");
    expect(props.provider_type).toBe("openai");
    expect(props.success).toBe(true);
    // Must not contain raw key material
    const serialized = JSON.stringify(props);
    expect(serialized).not.toMatch(/sk-|Bearer|ciphertext/i);
  });
});

describe("security-events — emitIngestError", () => {
  beforeEach(() => {
    process.env.POSTHOG_API_KEY = "phc_test";
    mockCapture.mockClear();
  });
  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
  });

  it("captures ingest error with error_class and job_type only", () => {
    emitIngestError({ workspaceId: "ws-abcdef", errorClass: "worker_crash", jobType: "connect_ingest" });
    const [, eventName, props] = mockCapture.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(eventName).toBe("security_ingest_error");
    expect(props.error_class).toBe("worker_crash");
    expect(props.job_type).toBe("connect_ingest");
  });
});
