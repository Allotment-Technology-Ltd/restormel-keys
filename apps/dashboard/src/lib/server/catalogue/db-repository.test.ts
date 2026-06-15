/**
 * Unit tests for the DB-backed CatalogueRepository (advisory plan §3.1 — the Phase-1 swap).
 *
 * Hermetic: the neon.ts read/write layer is INJECTED via DbCatalogueDeps with fake ModelRecord /
 * ProviderModelVariantRecord rows, so nothing here touches Postgres. Covers row→CatalogueModel
 * mapping (incl. migration-068 homeJurisdiction + variant processingRegion), listProviders,
 * listModelsForProvider (every matched model carries ALL its variants), and the empty-DB→seed
 * fallback that keeps the advisory from going blank offline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DbCatalogueRepository, type DbCatalogueDeps } from "./db-repository";
import { loadSeedModels } from "./seed-repository";
import type { ModelRecord, ProviderModelVariantRecord } from "../neon";

function model(partial: Partial<ModelRecord> & Pick<ModelRecord, "id" | "canonicalName">): ModelRecord {
  return {
    family: null,
    lifecycleState: "active",
    description: null,
    modalities: null,
    capabilities: null,
    contextWindow: null,
    maxOutputTokens: null,
    supportsTools: null,
    supportsStructuredOutput: null,
    supportsMcp: null,
    editorialSummary: null,
    strengths: null,
    weaknesses: null,
    recommendedFor: null,
    avoidFor: null,
    deprecationDate: null,
    retirementDate: null,
    replacementModelId: null,
    sourceLastVerifiedAt: null,
    homeJurisdiction: null,
    ...partial,
  };
}

function variant(
  partial: Partial<ProviderModelVariantRecord> &
    Pick<ProviderModelVariantRecord, "modelId" | "providerIntegrationType" | "providerModelId">,
): ProviderModelVariantRecord {
  return {
    id: `${partial.modelId}-${partial.providerIntegrationType}`,
    catalogProviderId: partial.providerIntegrationType,
    availabilityStatus: null,
    pricingRef: null,
    rateLimitRef: null,
    metadata: null,
    sourceLastVerifiedAt: null,
    processingRegion: null,
    ...partial,
  };
}

// A small fake catalogue: one EU chat model on two providers, one US embedding model on one.
const MODELS: ModelRecord[] = [
  model({
    id: "mistral-large",
    canonicalName: "Mistral Large",
    family: "mistral",
    capabilities: ["chat", "tools"],
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsMcp: false,
    homeJurisdiction: "EU/FR",
  }),
  model({
    id: "voyage-3-large",
    canonicalName: "Voyage 3 Large",
    family: "voyage",
    capabilities: ["embedding"],
    homeJurisdiction: "US",
  }),
];

const VARIANTS: ProviderModelVariantRecord[] = [
  variant({
    modelId: "mistral-large",
    providerIntegrationType: "mistral",
    providerModelId: "mistral-large-latest",
    processingRegion: "EU",
    pricingRef: "mistral/large",
    availabilityStatus: "available",
  }),
  variant({
    modelId: "mistral-large",
    providerIntegrationType: "together",
    providerModelId: "mistralai/Mistral-Large",
    processingRegion: "US",
    pricingRef: "together/mistral-large",
  }),
  variant({
    modelId: "voyage-3-large",
    providerIntegrationType: "voyage",
    providerModelId: "voyage-3-large",
    processingRegion: null,
  }),
];

function makeDeps(
  models: ModelRecord[],
  variants: ProviderModelVariantRecord[],
): DbCatalogueDeps & { register: ReturnType<typeof vi.fn> } {
  const register = vi.fn(async () => {});
  return {
    register,
    listModels: vi.fn(async () => models),
    listProviderModelVariantsByModelIds: vi.fn(async (ids: string[]) =>
      variants.filter((v) => ids.includes(v.modelId)),
    ),
    listVariantProviderTypes: vi.fn(async () => {
      const set = new Set(
        variants.map((v) => v.providerIntegrationType.trim().toLowerCase()).filter(Boolean),
      );
      return [...set].sort();
    }),
    registerUnverified: register,
  };
}

describe("DbCatalogueRepository — row → CatalogueModel mapping", () => {
  const repo = new DbCatalogueRepository(makeDeps(MODELS, VARIANTS));

  it("maps a model row incl. capability flags + migration-068 homeJurisdiction", async () => {
    const m = await repo.getModel("mistral-large");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("Mistral Large");
    expect(m!.family).toBe("mistral");
    expect(m!.lifecycleState).toBe("active");
    expect(m!.contextWindow).toBe(128000);
    expect(m!.maxOutputTokens).toBe(8192);
    expect(m!.supportsTools).toBe(true);
    expect(m!.supportsStructuredOutput).toBe(true);
    expect(m!.supportsMcp).toBe(false);
    expect(m!.capabilities).toEqual(["chat", "tools"]);
    expect(m!.homeJurisdiction).toBe("EU/FR");
  });

  it("maps variant rows incl. processingRegion + pricingRef + availabilityStatus", async () => {
    const m = await repo.getModel("mistral-large");
    const byProvider = Object.fromEntries((m!.variants ?? []).map((v) => [v.providerIntegrationType, v]));
    expect(byProvider.mistral.providerModelId).toBe("mistral-large-latest");
    expect(byProvider.mistral.processingRegion).toBe("EU");
    expect(byProvider.mistral.pricingRef).toBe("mistral/large");
    expect(byProvider.mistral.availabilityStatus).toBe("available");
    expect(byProvider.together.processingRegion).toBe("US");
  });

  it("capabilitiesFor / variantsFor delegate to the mapped model", async () => {
    expect(await repo.capabilitiesFor("voyage-3-large")).toEqual(["embedding"]);
    expect((await repo.variantsFor("voyage-3-large")).map((v) => v.providerIntegrationType)).toEqual([
      "voyage",
    ]);
  });

  it("getModel returns null for an unknown id", async () => {
    expect(await repo.getModel("nope")).toBeNull();
  });
});

describe("DbCatalogueRepository — listProviders", () => {
  it("returns distinct lowercased provider integration types, sorted", async () => {
    const repo = new DbCatalogueRepository(makeDeps(MODELS, VARIANTS));
    expect(await repo.listProviders()).toEqual(["mistral", "together", "voyage"]);
  });
});

describe("DbCatalogueRepository — listModelsForProvider", () => {
  const repo = new DbCatalogueRepository(makeDeps(MODELS, VARIANTS));

  it("returns models having a variant on the provider", async () => {
    const onTogether = await repo.listModelsForProvider("together");
    expect(onTogether.map((m) => m.id)).toEqual(["mistral-large"]);
  });

  it("each matched model carries ALL its variants (cross-provider cost/region works)", async () => {
    const [m] = await repo.listModelsForProvider("mistral");
    // mistral-large is offered on BOTH mistral and together — both must be present, not just the match.
    const providers = (m.variants ?? []).map((v) => v.providerIntegrationType).sort();
    expect(providers).toEqual(["mistral", "together"]);
  });

  it("is case-insensitive on the provider arg", async () => {
    expect((await repo.listModelsForProvider("TOGETHER")).map((m) => m.id)).toEqual(["mistral-large"]);
  });
});

describe("DbCatalogueRepository — registerUnverifiedModel", () => {
  it("idempotently upserts then reads back the registered model", async () => {
    // Simulate the DB gaining the row after the write so the read-back returns it.
    const live = [...MODELS];
    const deps = makeDeps(live, [...VARIANTS]);
    deps.registerUnverified = vi.fn(async (input) => {
      live.push(model({ id: input.id, canonicalName: input.id, lifecycleState: "unverified" }));
    });
    const repo = new DbCatalogueRepository(deps);

    const created = await repo.registerUnverifiedModel({ id: "grok-new", providerType: "xai" });
    expect(created.id).toBe("grok-new");
    expect(created.lifecycleState).toBe("unverified");
    expect(deps.registerUnverified).toHaveBeenCalledTimes(1);

    // Second call: row already exists → no second write.
    await repo.registerUnverifiedModel({ id: "grok-new", providerType: "xai" });
    expect(deps.registerUnverified).toHaveBeenCalledTimes(1);
  });
});

describe("DbCatalogueRepository — empty-DB → seed fallback", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("falls back to the bundled seed when the models table is empty (and logs once)", async () => {
    const repo = new DbCatalogueRepository(makeDeps([], []));

    const providers = await repo.listProviders();
    const seedModels = loadSeedModels();
    // The seed catalogue has real providers (e.g. openai, voyage) — proves the fallback engaged.
    expect(providers.length).toBeGreaterThan(0);
    expect(providers).toContain("openai");
    expect(providers).toContain("voyage");

    // listModelsForProvider also serves seed data.
    const openai = await repo.listModelsForProvider("openai");
    expect(openai.length).toBeGreaterThan(0);

    // getModel resolves a known seed model.
    const seedId = seedModels[0].id;
    expect(await repo.getModel(seedId)).not.toBeNull();

    // Logged the fallback (at least once), and only warns once across calls.
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.every((c: unknown[]) => String(c[0]).includes("falling back to seed"))).toBe(
      true,
    );
  });

  it("does NOT fall back when the DB has models", async () => {
    const repo = new DbCatalogueRepository(makeDeps(MODELS, VARIANTS));
    await repo.listModelsForProvider("mistral");
    await repo.listProviders();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
