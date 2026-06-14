import { describe, it, expect } from "vitest";
import { rankModelsForStage, evaluateRegion, type RegionFilter } from "./ranking";
import type { CatalogueModel } from "./types";
import type { RateResolver } from "./cost";

function chatModel(id: string, providerType: string, home: string | null, region: string | null): CatalogueModel {
  return {
    id,
    canonicalName: id,
    family: "openai",
    supportsStructuredOutput: true,
    capabilities: ["chat", "tools", "ingestion_extraction"],
    homeJurisdiction: home,
    variants: [{ providerIntegrationType: providerType, providerModelId: id, processingRegion: region }],
  };
}

const flatCost: RateResolver = () => ({ inputPerMillion: 1, outputPerMillion: 1 });

describe("provider-neutral ranking (§3.8)", () => {
  it("orders equal-verdict equal-cost models by name, independent of input order", () => {
    const models = [
      chatModel("zeta", "p", "US", "US"),
      chatModel("alpha", "p", "EU/FR", "EU"),
      chatModel("mid", "p", "CN", "CN"),
    ];
    const order = (ms: CatalogueModel[]) =>
      rankModelsForStage(ms, "extraction", { providerType: "p", costResolver: flatCost }).ranked.map((a) => a.model.id);
    expect(order(models)).toEqual(["alpha", "mid", "zeta"]);
    expect(order([...models].reverse())).toEqual(["alpha", "mid", "zeta"]);
  });

  it("a cheaper model outranks a pricier one with the same verdict — regardless of vendor", () => {
    const cheap = chatModel("z-cheap", "p", "EU/FR", "EU");
    const pricey = chatModel("a-pricey", "p", "US", "US");
    const resolver: RateResolver = (ref) =>
      ref.includes("cheap") ? { inputPerMillion: 0.5, outputPerMillion: 0.5 } : { inputPerMillion: 5, outputPerMillion: 5 };
    const { ranked } = rankModelsForStage([pricey, cheap], "extraction", { providerType: "p", costResolver: resolver });
    expect(ranked[0].model.id).toBe("z-cheap"); // cheaper wins despite alphabetical disadvantage
  });

  it("wrong_type (embedding-only) models rank last", () => {
    const chat = chatModel("chat", "p", "US", "US");
    const embed: CatalogueModel = {
      id: "embed",
      canonicalName: "embed",
      capabilities: ["embedding", "ingestion_embedding"],
      homeJurisdiction: "US",
      variants: [{ providerIntegrationType: "p", providerModelId: "embed", processingRegion: "US" }],
    };
    const { ranked } = rankModelsForStage([embed, chat], "extraction", { providerType: "p", costResolver: flatCost });
    expect(ranked[ranked.length - 1].model.id).toBe("embed");
    expect(ranked[ranked.length - 1].suitability.verdict).toBe("wrong_type");
  });
});

describe("region/jurisdiction filtering (§3.8)", () => {
  it("EU-only home filter keeps EU, drops US, surfaces the count", () => {
    const models = [
      chatModel("us1", "p", "US", "US"),
      chatModel("eu1", "p", "EU/FR", "EU"),
      chatModel("us2", "p", "US", "US"),
    ];
    const res = rankModelsForStage(models, "extraction", {
      providerType: "p",
      costResolver: flatCost,
      regionFilter: { homeJurisdictions: ["EU/FR"] },
    });
    expect(res.ranked.map((a) => a.model.id)).toEqual(["eu1"]);
    expect(res.hiddenByRegion).toBe(2);
  });

  it("excludeProcessingRegions drops matching variants", () => {
    const f: RegionFilter = { excludeProcessingRegions: ["CN"] };
    expect(evaluateRegion(chatModel("x", "p", "CN", "CN"), { providerIntegrationType: "p", providerModelId: "x", processingRegion: "CN" }, f).pass).toBe(false);
    expect(evaluateRegion(chatModel("y", "p", "US", "US"), { providerIntegrationType: "p", providerModelId: "y", processingRegion: "US" }, f).pass).toBe(true);
  });

  it("unknown (null) region is dropped by a positive filter unless keepUnknownRegion", () => {
    const m = chatModel("aiz", "aizolo", "US", null); // aizolo processing region unknown
    const variant = m.variants![0];
    const drop = evaluateRegion(m, variant, { processingRegions: ["EU"] });
    expect(drop.pass).toBe(false);
    expect(drop.unknown).toBe(true);
    const keep = evaluateRegion(m, variant, { processingRegions: ["EU"], keepUnknownRegion: true });
    expect(keep.pass).toBe(true);
    expect(keep.unknown).toBe(true);
  });
});
