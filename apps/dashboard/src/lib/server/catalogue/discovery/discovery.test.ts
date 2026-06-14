import { describe, it, expect } from "vitest";
import { parseOpenRouterModels, type OpenRouterModelsResponse } from "./openrouter";
import { refreshFromSources, computeDeprecationCandidates, catalogueIdForDiscovered } from "./refresh";
import type { CatalogueSource, DiscoveredModel } from "./types";
import { InMemoryCatalogueRepository } from "../repository";
import type { CatalogueModel } from "../types";

const orPayload: OpenRouterModelsResponse = {
  data: [
    {
      id: "anthropic/claude-sonnet-4",
      name: "Claude Sonnet 4",
      context_length: 200000,
      pricing: { prompt: "0.000003", completion: "0.000015" },
    },
    // free model → pricing "0" must resolve to unknown, never $0
    { id: "meta-llama/llama-3.3-70b", context_length: 131072, pricing: { prompt: "0", completion: "0" } },
  ],
};

describe("parseOpenRouterModels", () => {
  it("converts $/token to $/1M and extracts the underlying family", () => {
    const ms = parseOpenRouterModels(orPayload);
    const claude = ms.find((m) => m.providerModelId === "anthropic/claude-sonnet-4")!;
    expect(claude.inputPerMillion).toBeCloseTo(3, 6);
    expect(claude.outputPerMillion).toBeCloseTo(15, 6);
    expect(claude.family).toBe("anthropic");
    const llama = ms.find((m) => m.providerModelId === "meta-llama/llama-3.3-70b")!;
    expect(llama.inputPerMillion).toBeNull();
    expect(llama.family).toBe("meta-llama");
  });
});

function fakeSource(models: DiscoveredModel[]): CatalogueSource {
  return { providerType: "openrouter", async fetchModels() { return models; } };
}

describe("refreshFromSources", () => {
  it("registers new models as unverified and is idempotent", async () => {
    const repo = new InMemoryCatalogueRepository();
    const src = fakeSource(parseOpenRouterModels(orPayload));
    const r1 = await refreshFromSources(repo, [src]);
    expect(r1.added.length).toBe(2);
    const firstId = catalogueIdForDiscovered(parseOpenRouterModels(orPayload)[0]);
    expect((await repo.getModel(firstId))?.lifecycleState).toBe("unverified");
    const r2 = await refreshFromSources(repo, [src]);
    expect(r2.added.length).toBe(0); // idempotent
    expect(r2.discovered).toBe(2);
  });
});

describe("computeDeprecationCandidates", () => {
  it("flags absent discovered models but never hand-seeded ones", () => {
    const existing: CatalogueModel[] = [
      { id: "openrouter-old-model", canonicalName: "old", provenance: "discovered" },
      { id: "seed-model", canonicalName: "seed", provenance: "seed" },
    ];
    const candidates = computeDeprecationCandidates(existing, new Set(["openrouter-still-here"]));
    expect(candidates).toContain("openrouter-old-model");
    expect(candidates).not.toContain("seed-model");
  });
});
