/**
 * Provider adapters tests. No real API calls; fetch is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  openaiProvider,
  OPENAI_MODELS,
  anthropicProvider,
  ANTHROPIC_MODELS,
  googleProvider,
  GOOGLE_MODELS,
} from "./index.js";

describe("provider model lists", () => {
  it("openai exposes expected models", () => {
    expect(openaiProvider.models).toEqual([...OPENAI_MODELS]);
    expect(openaiProvider.models).toContain("gpt-4o");
    expect(openaiProvider.models).toContain("gpt-4o-mini");
    expect(openaiProvider.models).toContain("o1");
  });

  it("anthropic exposes expected models", () => {
    expect(anthropicProvider.models).toEqual([...ANTHROPIC_MODELS]);
    expect(anthropicProvider.models).toContain("claude-sonnet-4");
    expect(anthropicProvider.models).toContain("claude-haiku-4.5");
    expect(anthropicProvider.models).toContain("claude-opus-4");
  });

  it("google exposes expected models", () => {
    expect(googleProvider.models).toEqual([...GOOGLE_MODELS]);
    expect(googleProvider.models).toContain("gemini-2.5-pro");
    expect(googleProvider.models).toContain("gemini-2.5-flash");
  });
});

describe("cost estimation", () => {
  it("openai returns correct cost for gpt-4o", () => {
    const est = openaiProvider.estimateCost("gpt-4o");
    expect(est).not.toBeNull();
    expect(est!.id).toBe("gpt-4o");
    expect(est!.inputPerMillion).toBe(2.5);
    expect(est!.outputPerMillion).toBe(10);
    expect(est!.unit).toBe("USD");
  });

  it("openai returns correct cost for gpt-4o-mini", () => {
    const est = openaiProvider.estimateCost("gpt-4o-mini");
    expect(est).not.toBeNull();
    expect(est!.inputPerMillion).toBe(0.15);
    expect(est!.outputPerMillion).toBe(0.6);
  });

  it("openai returns correct cost for o1", () => {
    const est = openaiProvider.estimateCost("o1");
    expect(est).not.toBeNull();
    expect(est!.inputPerMillion).toBe(15);
    expect(est!.outputPerMillion).toBe(60);
  });

  it("openai returns null for unknown model", () => {
    expect(openaiProvider.estimateCost("unknown-model")).toBeNull();
  });

  it("anthropic returns correct cost for claude-sonnet-4", () => {
    const est = anthropicProvider.estimateCost("claude-sonnet-4");
    expect(est).not.toBeNull();
    expect(est!.id).toBe("claude-sonnet-4");
    expect(est!.inputPerMillion).toBe(3);
    expect(est!.outputPerMillion).toBe(15);
  });

  it("anthropic returns correct cost for claude-haiku-4.5", () => {
    const est = anthropicProvider.estimateCost("claude-haiku-4.5");
    expect(est).not.toBeNull();
    expect(est!.inputPerMillion).toBe(0.25);
    expect(est!.outputPerMillion).toBe(1.25);
  });

  it("google returns correct cost for gemini-2.5-pro", () => {
    const est = googleProvider.estimateCost("gemini-2.5-pro");
    expect(est).not.toBeNull();
    expect(est!.id).toBe("gemini-2.5-pro");
    expect(est!.inputPerMillion).toBe(1.25);
    expect(est!.outputPerMillion).toBe(5);
  });

  it("google returns correct cost for gemini-2.5-flash", () => {
    const est = googleProvider.estimateCost("gemini-2.5-flash");
    expect(est).not.toBeNull();
    expect(est!.inputPerMillion).toBe(0.075);
    expect(est!.outputPerMillion).toBe(0.3);
  });
});

describe("validateKey with mocked fetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("openai validateKey returns valid when fetch returns 200", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    const result = await openaiProvider.validateKey("sk-fake", mockFetch as typeof fetch);

    expect(result.valid).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer sk-fake" },
      })
    );
  });

  it("openai validateKey returns invalid when fetch returns 401", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    } as Response);

    const result = await openaiProvider.validateKey("sk-bad", mockFetch as typeof fetch);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("401");
  });

  it("anthropic validateKey uses x-api-key header", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await anthropicProvider.validateKey("key-fake", mockFetch as typeof fetch);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "key-fake" }),
      })
    );
  });

  it("google validateKey passes key as query param", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await googleProvider.validateKey("google-key", mockFetch as typeof fetch);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("key=" + encodeURIComponent("google-key")),
      expect.any(Object)
    );
  });

  it("validateKey returns invalid on fetch throw", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await openaiProvider.validateKey("sk-any", mockFetch as typeof fetch);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Network error");
  });
});

describe("createClient", () => {
  it("openai createClient returns provider and baseUrl", () => {
    const client = openaiProvider.createClient("sk-x");
    expect(client.provider).toBe("openai");
    expect(client.baseUrl).toBe("https://api.openai.com");
  });

  it("anthropic createClient returns provider and baseUrl", () => {
    const client = anthropicProvider.createClient("key");
    expect(client.provider).toBe("anthropic");
    expect(client.baseUrl).toBe("https://api.anthropic.com");
  });

  it("google createClient returns provider and baseUrl", () => {
    const client = googleProvider.createClient("key");
    expect(client.provider).toBe("google");
    expect(client.baseUrl).toBe("https://generativelanguage.googleapis.com");
  });
});
