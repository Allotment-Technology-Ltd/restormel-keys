import { describe, expect, it } from "vitest";
import {
  buildModelIdsByProvider,
  enrichIngestionRouteBuilderCatalog,
  recommendedModelIdsForIngestionStage,
} from "./route-builder-model-catalog";

describe("route-builder-model-catalog", () => {
  it("excludes retired provider variants", () => {
    const modelRows = [{ id: "gpt-4-turbo", canonicalName: "gpt-4-turbo" }];
    const variantRows = [
      {
        id: "gpt-4-turbo-openai",
        modelId: "gpt-4-turbo",
        providerIntegrationType: "openai",
        catalogProviderId: "openai",
        providerModelId: "gpt-4-turbo",
        availabilityStatus: "retired",
        pricingRef: null,
        rateLimitRef: null,
        metadata: null,
        sourceLastVerifiedAt: null,
      },
    ];
    expect(buildModelIdsByProvider(modelRows, variantRows).openai).toEqual([]);
  });

  it("lists stage-specific recommended model ids", () => {
    expect(recommendedModelIdsForIngestionStage("ingestion_extraction")).toContain("claude-sonnet-4-6");
    expect(recommendedModelIdsForIngestionStage("ingestion_validation")).toContain("gpt-5.2");
  });

  it("enriches openai picker with production ingest models", () => {
    const modelRows = [
      { id: "gpt-5.2", canonicalName: "gpt-5.2" },
      { id: "gpt-4o-mini", canonicalName: "gpt-4o-mini" },
    ];
    const variantRows = [
      {
        id: "gpt-5.2-openai",
        modelId: "gpt-5.2",
        providerIntegrationType: "openai",
        catalogProviderId: "openai",
        providerModelId: "gpt-5.2",
        availabilityStatus: "available",
        pricingRef: null,
        rateLimitRef: null,
        metadata: null,
        sourceLastVerifiedAt: null,
      },
    ];
    const modelIdsByProvider = buildModelIdsByProvider(modelRows, variantRows);
    modelIdsByProvider.openai = [];
    const modelCatalog: { id: string; name: string }[] = [];
    enrichIngestionRouteBuilderCatalog({ modelIdsByProvider, modelCatalog, modelRows, variantRows });
    expect(modelIdsByProvider.openai).toContain("gpt-5.2");
    expect(modelCatalog.find((m) => m.id === "gpt-5.2")?.name).toBe("gpt-5.2");
  });
});
