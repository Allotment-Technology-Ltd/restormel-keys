import { describe, expect, it } from "vitest";
import { buildCrossModelProductionChain } from "./model-guidance";

describe("buildCrossModelProductionChain", () => {
  it("picks extraction from anthropic when both openai and anthropic connected", () => {
    const chain = buildCrossModelProductionChain(new Set(["openai", "anthropic"]));
    expect(chain.extraction?.modelId).toBe("claude-sonnet-4-6");
    expect(chain.extraction?.provider).toBe("anthropic");
  });

  it("routes validation to a different provider than extraction when possible", () => {
    const chain = buildCrossModelProductionChain(new Set(["openai", "anthropic"]));
    expect(chain.validation?.provider).not.toBe(chain.extraction?.provider);
    expect(chain.validation?.modelId).toBe("gpt-5.2");
  });

  it("avoids upstream providers from extract, relate, and grouping when picking validation", () => {
    const chain = buildCrossModelProductionChain(new Set(["openai", "anthropic", "google"]), {
      upstream: {
        providers: new Set(["anthropic"]),
        modelIds: new Set(["claude-sonnet-4-6"]),
      },
    });
    expect(chain.validation?.provider).not.toBe("anthropic");
    expect(["openai", "google"]).toContain(chain.validation?.provider);
  });

  it("falls back to same provider when only one provider key exists and upstream uses that provider", () => {
    const chain = buildCrossModelProductionChain(new Set(["openai"]), {
      upstream: {
        providers: new Set(["openai"]),
        modelIds: new Set(["gpt-5.2"]),
      },
    });
    expect(chain.validation?.provider).toBe("openai");
    expect(chain.validation?.sameProviderFallback).toBe(true);
  });

  it("falls back to any connected provider when only one is available", () => {
    const chain = buildCrossModelProductionChain(new Set(["openai"]));
    expect(chain.extraction?.provider).toBe("openai");
    expect(chain.validation?.provider).toBe("openai");
    expect(chain.validation?.sameProviderFallback).toBe(true);
  });

  it("prefers voyage for embedding at default 1024 dimensions", () => {
    const chain = buildCrossModelProductionChain(new Set(["openai", "voyage"]));
    expect(chain.embedding?.provider).toBe("voyage");
    expect(chain.embedding?.modelId).toBe("voyage-3");
  });

  it("locks embedding recommendation when graph already has vectors", () => {
    const chain = buildCrossModelProductionChain(new Set(["openai", "voyage"]), {
      embeddingLock: { dimensions: 1024, embeddedUnitCount: 12, model: "voyage-3" },
    });
    expect(chain.embedding?.modelId).toBe("voyage-3");
    expect(chain.embedding?.rationale).toMatch(/locked/i);
  });

  it("picks a voyage model that supports non-default pack dimensions", () => {
    const chain = buildCrossModelProductionChain(new Set(["voyage"]), {
      embeddingDimensions: 512,
    });
    expect(chain.embedding?.provider).toBe("voyage");
    expect(chain.embedding?.modelId).toMatch(/^voyage-3/);
  });

  it("routes production ingest through Together when that is the only connected provider", () => {
    const chain = buildCrossModelProductionChain(new Set(["together"]));
    expect(chain.extraction?.provider).toBe("together");
    expect(chain.extraction?.modelId).toBe("claude-sonnet-4-6");
    expect(chain.validation?.provider).toBe("together");
    expect(chain.validation?.modelId).not.toBe(chain.extraction?.modelId);
    expect(chain.embedding?.provider).toBe("together");
    expect(chain.embedding?.modelId).toBe("together-multilingual-e5-large");
  });

  it("prefers direct Anthropic over Together when both keys exist", () => {
    const chain = buildCrossModelProductionChain(new Set(["anthropic", "together"]));
    expect(chain.extraction?.provider).toBe("anthropic");
    expect(chain.extraction?.modelId).toBe("claude-sonnet-4-6");
  });
});
