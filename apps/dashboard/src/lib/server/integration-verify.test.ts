import { describe, it, expect, beforeEach } from "vitest";
import {
  runIntegrationVerificationProbe,
  sanitizeProviderMessage,
  isVerifiableProviderType,
  checkIntegrationVerifyRateLimit,
  resetIntegrationVerifyRateLimit,
  integrationVerifyTimeoutMs,
  type IntegrationVerifyOutcome,
} from "./integration-verify";

const KEY = "sk-test-supersecret-key-1234567890abcdef";

type CapturedRequest = { url: string; method: string; headers: Record<string, string> };

function mockFetch(
  responder: (url: string) => Response | Promise<Response>,
  captured?: CapturedRequest[]
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    captured?.push({
      url,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return responder(url);
  }) as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function probe(
  providerType: string,
  fetchImpl: typeof fetch,
  credential: { mode: "encrypted"; apiKey: string } | { mode: "reference" } | { mode: "none" } = {
    mode: "encrypted",
    apiKey: KEY,
  }
): Promise<IntegrationVerifyOutcome> {
  return runIntegrationVerificationProbe({ providerType, credential, fetchImpl, timeoutMs: 2000 });
}

describe("runIntegrationVerificationProbe — taxonomy", () => {
  it("valid: authenticated 2xx is the only path to verified", async () => {
    const out = await probe("openai", mockFetch(() => jsonResponse(200, { data: [] })));
    expect(out.resultKind).toBe("valid");
    expect(out.verificationStatus).toBe("verified");
    expect(out.persistStatus).toBe(true);
  });

  it("invalid_credentials: 401 persists failed", async () => {
    const out = await probe(
      "openai",
      mockFetch(() => jsonResponse(401, { error: { message: "Incorrect API key provided" } }))
    );
    expect(out.resultKind).toBe("invalid_credentials");
    expect(out.verificationStatus).toBe("failed");
    expect(out.persistStatus).toBe(true);
    expect(out.detail).toContain("Incorrect API key provided");
  });

  it("invalid_credentials: 403 persists failed", async () => {
    const out = await probe("mistral", mockFetch(() => jsonResponse(403, { message: "Forbidden" })));
    expect(out.resultKind).toBe("invalid_credentials");
    expect(out.verificationStatus).toBe("failed");
    expect(out.persistStatus).toBe(true);
  });

  it("network_error: thrown fetch (DNS failure) is indeterminate — never persisted", async () => {
    const out = await probe(
      "openai",
      (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch
    );
    expect(out.resultKind).toBe("network_error");
    expect(out.persistStatus).toBe(false);
    expect(out.detail).toContain("NOT marked invalid");
  });

  it("network_error: timeout is indeterminate — never persisted", async () => {
    const out = await probe(
      "anthropic",
      (async () => {
        const e = new Error("timed out");
        e.name = "TimeoutError";
        throw e;
      }) as typeof fetch
    );
    expect(out.resultKind).toBe("network_error");
    expect(out.persistStatus).toBe(false);
  });

  it("network_error: provider 5xx never collapses into invalid_credentials", async () => {
    const out = await probe("groq", mockFetch(() => jsonResponse(503, { error: "overloaded" })));
    expect(out.resultKind).toBe("network_error");
    expect(out.verificationStatus).toBe("pending");
    expect(out.persistStatus).toBe(false);
  });

  it("network_error: provider 429 (rate limit) never collapses into invalid_credentials", async () => {
    const out = await probe("together", mockFetch(() => jsonResponse(429, { error: "slow down" })));
    expect(out.resultKind).toBe("network_error");
    expect(out.persistStatus).toBe(false);
  });

  it("unsupported_provider: no probe spec stays pending (persisted, honest copy)", async () => {
    let called = false;
    const out = await probe(
      "some_custom_gateway",
      mockFetch(() => {
        called = true;
        return jsonResponse(200, {});
      })
    );
    expect(out.resultKind).toBe("unsupported_provider");
    expect(out.verificationStatus).toBe("pending");
    expect(out.persistStatus).toBe(true);
    expect(called).toBe(false);
  });

  it("reference_only: vault references are never probed", async () => {
    let called = false;
    const out = await probe(
      "openai",
      mockFetch(() => {
        called = true;
        return jsonResponse(200, {});
      }),
      { mode: "reference" }
    );
    expect(out.resultKind).toBe("reference_only");
    expect(out.verificationStatus).toBe("reference_only");
    expect(out.persistStatus).toBe(true);
    expect(called).toBe(false);
  });

  it("no_credential: nothing stored fails without a network call", async () => {
    let called = false;
    const out = await probe(
      "openai",
      mockFetch(() => {
        called = true;
        return jsonResponse(200, {});
      }),
      { mode: "none" }
    );
    expect(out.resultKind).toBe("no_credential");
    expect(out.verificationStatus).toBe("failed");
    expect(out.persistStatus).toBe(true);
    expect(called).toBe(false);
  });
});

describe("runIntegrationVerificationProbe — auth shapes per family", () => {
  it("openai-compatible families send Authorization: Bearer", async () => {
    for (const provider of ["openai", "mistral", "together", "deepseek", "groq", "cohere", "voyage", "aizolo"]) {
      const captured: CapturedRequest[] = [];
      await probe(provider, mockFetch(() => jsonResponse(200, {}), captured));
      expect(captured).toHaveLength(1);
      expect(captured[0].method).toBe("GET");
      expect(captured[0].headers.Authorization).toBe(`Bearer ${KEY}`);
    }
  });

  it("anthropic sends x-api-key + anthropic-version", async () => {
    const captured: CapturedRequest[] = [];
    await probe("anthropic", mockFetch(() => jsonResponse(200, {}), captured));
    expect(captured[0].url).toContain("api.anthropic.com/v1/models");
    expect(captured[0].headers["x-api-key"]).toBe(KEY);
    expect(captured[0].headers["anthropic-version"]).toBeTruthy();
    expect(captured[0].headers.Authorization).toBeUndefined();
  });

  it("vertex/google aliases probe Generative Language with x-goog-api-key", async () => {
    for (const alias of ["vertex", "google", "google_cloud", "vertex_ai"]) {
      const captured: CapturedRequest[] = [];
      await probe(alias, mockFetch(() => jsonResponse(200, {}), captured));
      expect(captured[0].url).toContain("generativelanguage.googleapis.com");
      expect(captured[0].headers["x-goog-api-key"]).toBe(KEY);
    }
  });

  it("openrouter probes the authenticated /api/v1/key endpoint, not the public models list", async () => {
    const captured: CapturedRequest[] = [];
    await probe("openrouter", mockFetch(() => jsonResponse(200, {}), captured));
    expect(captured[0].url).toBe("https://openrouter.ai/api/v1/key");
  });

  it("vercel AI gateway aliases probe /v1/credits", async () => {
    for (const alias of ["vercel", "vercel_ai", "vercel_ai_gateway", "Vercel AI"]) {
      const captured: CapturedRequest[] = [];
      await probe(alias, mockFetch(() => jsonResponse(200, {}), captured));
      expect(captured[0].url).toBe("https://ai-gateway.vercel.sh/v1/credits");
    }
  });

  it("portkey sends x-portkey-api-key", async () => {
    const captured: CapturedRequest[] = [];
    await probe("portkey", mockFetch(() => jsonResponse(200, {}), captured));
    expect(captured[0].headers["x-portkey-api-key"]).toBe(KEY);
  });
});

describe("key hygiene — secrets never reach detail text", () => {
  it("scrubs the key when the provider echoes it back in an error body", async () => {
    const out = await probe(
      "openai",
      mockFetch(() => jsonResponse(401, { error: { message: `Invalid key: ${KEY} was rejected` } }))
    );
    expect(out.detail).not.toContain(KEY);
    expect(out.detail).toContain("[redacted]");
  });

  it("sanitizeProviderMessage redacts Bearer tokens and key-shaped strings", () => {
    const msg = sanitizeProviderMessage(
      "Authorization: Bearer abc.def-123456789012345 failed; also sk-proj-abcdefghijklmnop was bad",
      KEY
    );
    expect(msg).not.toContain("abc.def-123456789012345");
    expect(msg).not.toContain("sk-proj-abcdefghijklmnop");
  });

  it("sanitizeProviderMessage collapses whitespace and truncates long bodies", () => {
    const msg = sanitizeProviderMessage(`a\n\n${"b".repeat(500)}`, KEY);
    expect(msg.length).toBeLessThanOrEqual(201); // 200 chars + ellipsis
    expect(msg).not.toContain("\n");
  });

  it("no outcome detail ever contains the key (all response statuses)", async () => {
    for (const status of [200, 401, 403, 404, 429, 500]) {
      const out = await probe(
        "openai",
        mockFetch(() => jsonResponse(status, { error: { message: `echo ${KEY}` } }))
      );
      expect(out.detail).not.toContain(KEY);
    }
  });

  it("handles non-JSON error bodies without leaking", async () => {
    const out = await probe(
      "openai",
      mockFetch(() => new Response(`<html>denied ${KEY}</html>`, { status: 401 }))
    );
    expect(out.resultKind).toBe("invalid_credentials");
    expect(out.detail).not.toContain(KEY);
  });
});

describe("isVerifiableProviderType", () => {
  it("covers catalog families and rejects unknowns", () => {
    expect(isVerifiableProviderType("openai")).toBe(true);
    expect(isVerifiableProviderType("Anthropic")).toBe(true);
    expect(isVerifiableProviderType("vercel_ai_gateway")).toBe(true);
    expect(isVerifiableProviderType("voyage")).toBe(true);
    expect(isVerifiableProviderType("aizolo")).toBe(true);
    expect(isVerifiableProviderType("totally_unknown")).toBe(false);
  });
});

describe("integrationVerifyTimeoutMs", () => {
  it("defaults to 8s and clamps env overrides", () => {
    const prev = process.env.RESTORMEL_INTEGRATION_VERIFY_TIMEOUT_MS;
    try {
      delete process.env.RESTORMEL_INTEGRATION_VERIFY_TIMEOUT_MS;
      expect(integrationVerifyTimeoutMs()).toBe(8000);
      process.env.RESTORMEL_INTEGRATION_VERIFY_TIMEOUT_MS = "50";
      expect(integrationVerifyTimeoutMs()).toBe(1000);
      process.env.RESTORMEL_INTEGRATION_VERIFY_TIMEOUT_MS = "999999";
      expect(integrationVerifyTimeoutMs()).toBe(30000);
      process.env.RESTORMEL_INTEGRATION_VERIFY_TIMEOUT_MS = "not-a-number";
      expect(integrationVerifyTimeoutMs()).toBe(8000);
    } finally {
      if (prev === undefined) delete process.env.RESTORMEL_INTEGRATION_VERIFY_TIMEOUT_MS;
      else process.env.RESTORMEL_INTEGRATION_VERIFY_TIMEOUT_MS = prev;
    }
  });
});

describe("checkIntegrationVerifyRateLimit", () => {
  beforeEach(() => {
    resetIntegrationVerifyRateLimit();
  });

  it("allows the default 5 probes per window, then blocks with retry-after", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      const d = checkIntegrationVerifyRateLimit("int-1", t0 + i * 1000);
      expect(d.allowed).toBe(true);
    }
    const blocked = checkIntegrationVerifyRateLimit("int-1", t0 + 5000);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it("windows are per integration id", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 5; i += 1) checkIntegrationVerifyRateLimit("int-a", t0);
    expect(checkIntegrationVerifyRateLimit("int-a", t0).allowed).toBe(false);
    expect(checkIntegrationVerifyRateLimit("int-b", t0).allowed).toBe(true);
  });

  it("a fresh window opens after 60s", () => {
    const t0 = 3_000_000;
    for (let i = 0; i < 6; i += 1) checkIntegrationVerifyRateLimit("int-c", t0);
    expect(checkIntegrationVerifyRateLimit("int-c", t0 + 59_000).allowed).toBe(false);
    expect(checkIntegrationVerifyRateLimit("int-c", t0 + 60_000).allowed).toBe(true);
  });
});
