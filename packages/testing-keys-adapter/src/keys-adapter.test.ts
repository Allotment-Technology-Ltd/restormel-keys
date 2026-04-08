import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveModel } from "./adapter.js";
import { createStubKeysTransport } from "./transport-stub.js";

const PRIMARY = "ref:restormel-keys:llm/primary";

describe("resolveModel", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...prevEnv };
  });

  afterEach(() => {
    process.env = prevEnv;
    vi.unstubAllGlobals();
  });

  it("resolves via Keys-backed stub transport and captures metadata", async () => {
    process.env.TEST_BYOK_KEY = "test-secret-key";
    const transport = createStubKeysTransport({
      [PRIMARY]: {
        provider: "openai",
        model: "gpt-4o-mini",
        secretEnvVar: "TEST_BYOK_KEY",
        baseUrl: "https://api.openai.com/v1",
      },
    });

    const r = await resolveModel(PRIMARY, { transport });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
    expect(r.model.meta.logicalRef).toBe(PRIMARY);
    expect(r.model.meta.provider).toBe("openai");
    expect(r.model.meta.model).toBe("gpt-4o-mini");
    expect(r.model.meta.resolutionSource).toBe("keys");
    expect(r.model.modelId).toBe("gpt-4o-mini");
    expect(r.model.providerBaseUrl).toBe("https://api.openai.com/v1");
    expect(r.model.credentials.apiKey).toBe("test-secret-key");
  });

  it("fails with keys_not_configured when Keys is not wired and fallback is off", async () => {
    const r = await resolveModel(PRIMARY, {});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("keys_not_configured");
  });

  it("uses documented env fallback with explicit warning when Keys fails", async () => {
    process.env.OPENAI_API_KEY = "fallback-key";
    const transport = {
      async resolve() {
        return { ok: false as const, code: "unavailable", message: "Keys offline" };
      },
    };

    const r = await resolveModel(PRIMARY, {
      transport,
      openAiEnvFallback: { enabled: true },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.some((w) => w.includes("RESTORMEL_TESTING_KEYS_FALLBACK"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("Keys resolution failed"))).toBe(true);
    expect(r.model.meta.resolutionSource).toBe("env_fallback");
    expect(r.model.meta.provider).toBe("openai");
    expect(r.model.credentials.apiKey).toBe("fallback-key");
  });

  it("fails fallback when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const transport = {
      async resolve() {
        return { ok: false as const, code: "x", message: "fail" };
      },
    };
    const r = await resolveModel(PRIMARY, {
      transport,
      openAiEnvFallback: { enabled: true },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("fallback_missing_env");
  });

  it("resolves via HTTP transport when Keys returns a valid body", async () => {
    process.env.PROVIDER_KEY_SLOT = "http-resolved-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            provider: "openai",
            model: "gpt-4o",
            secretEnvVar: "PROVIDER_KEY_SLOT",
          }),
        }),
      ),
    );

    const r = await resolveModel(PRIMARY, { keysApiBaseUrl: "https://keys.example.test" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.model.meta.resolutionSource).toBe("keys");
    expect(r.model.credentials.apiKey).toBe("http-resolved-key");
    expect(fetch).toHaveBeenCalledWith(
      "https://keys.example.test/v1/testing/resolve-model",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ logicalRef: PRIMARY }),
      }),
    );
  });

  it("rejects invalid logical ref", async () => {
    const r = await resolveModel("not-a-ref", { openAiEnvFallback: { enabled: true } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("invalid_ref");
  });
});
