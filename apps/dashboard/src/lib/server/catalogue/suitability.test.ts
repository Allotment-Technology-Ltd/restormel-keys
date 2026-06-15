import { describe, it, expect } from "vitest";
import { deriveSuitability, isEmbeddingOnly } from "./suitability";
import type { CatalogueModel } from "./types";

const embeddingModel: CatalogueModel = {
  id: "voyage-3-large",
  canonicalName: "voyage-3-large",
  family: "voyage-3",
  capabilities: ["embedding", "ingestion_embedding"],
};
const chatModel: CatalogueModel = {
  id: "gpt-5.2",
  canonicalName: "gpt-5.2",
  family: "gpt-5",
  supportsStructuredOutput: true,
  capabilities: ["chat", "tools", "ingestion_extraction", "ingestion_validation"],
};
const noStructuredOutput: CatalogueModel = {
  id: "weak-chat",
  canonicalName: "weak-chat",
  family: "meta",
  supportsStructuredOutput: false,
  capabilities: ["chat"],
};

describe("embedding stage hard guard (both directions)", () => {
  it("rejects a chat model on the embedding stage", () => {
    const s = deriveSuitability(chatModel, "embedding");
    expect(s.verdict).toBe("wrong_type");
    expect(s.blocked).toBe(true);
  });
  it("accepts an embedding model on the embedding stage", () => {
    expect(deriveSuitability(embeddingModel, "embedding").verdict).toBe("recommended");
  });
  it("rejects an embedding-only model on a chat stage", () => {
    const s = deriveSuitability(embeddingModel, "extraction");
    expect(s.verdict).toBe("wrong_type");
    expect(s.blocked).toBe(true);
  });
  it("isEmbeddingOnly is true only when there is no chat capability", () => {
    expect(isEmbeddingOnly(embeddingModel)).toBe(true);
    expect(isEmbeddingOnly(chatModel)).toBe(false);
  });
});

describe("chat-stage verdicts", () => {
  it("recommends a model tagged for the stage with structured output", () => {
    expect(deriveSuitability(chatModel, "extraction").verdict).toBe("recommended");
  });
  it("caveats extraction without structured output (advisory, not blocked)", () => {
    const s = deriveSuitability(noStructuredOutput, "extraction");
    expect(s.verdict).toBe("caveat");
    expect(s.blocked).toBe(false);
  });
  it("usable when chat-capable but no stage tag", () => {
    const generic: CatalogueModel = { id: "g", canonicalName: "g", supportsStructuredOutput: true, capabilities: ["chat"] };
    expect(deriveSuitability(generic, "grouping").verdict).toBe("usable");
  });
  it("unknown for a free-text model not in the catalogue", () => {
    expect(deriveSuitability(null, "extraction").verdict).toBe("unknown");
  });
});

describe("cross-model validation caveat (§3.6)", () => {
  const validator: CatalogueModel = {
    id: "claude-sonnet-4-6",
    canonicalName: "claude-sonnet-4-6",
    family: "claude",
    capabilities: ["chat", "ingestion_validation"],
  };
  it("caveats when validator shares the upstream family", () => {
    const s = deriveSuitability(validator, "validation", { upstreamFamilies: new Set(["anthropic"]) });
    expect(s.verdict).toBe("caveat");
    expect(s.rationale).toMatch(/anthropic/);
  });
  it("recommends when validator is a different family from upstream", () => {
    const s = deriveSuitability(validator, "validation", { upstreamFamilies: new Set(["openai"]) });
    expect(s.verdict).toBe("recommended");
  });
});
