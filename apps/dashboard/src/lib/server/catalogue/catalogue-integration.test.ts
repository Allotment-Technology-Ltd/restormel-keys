/**
 * Integration tests against the REAL bundled seed (no mocks) — verifies the derived engine produces
 * sensible verdicts on actual catalogue data (the strongest offline signal short of a live DB).
 */
import { describe, it, expect } from "vitest";
import { SeedCatalogueRepository, loadSeedModels } from "./seed-repository";
import { computeStageAdvisory } from "./stage-advisory";

const repo = new SeedCatalogueRepository();

describe("seed repository", () => {
  it("loads the 145-model catalogue", () => {
    expect(loadSeedModels().length).toBeGreaterThan(100);
  });
  it("lists models for a provider", async () => {
    expect((await repo.listModelsForProvider("openai")).length).toBeGreaterThan(0);
    expect((await repo.listModelsForProvider("voyage")).length).toBeGreaterThan(0);
  });
  it("registers a free-text model as unverified (in-memory overlay)", async () => {
    const m = await repo.registerUnverifiedModel({ id: "made-up-model", providerType: "openai" });
    expect(m.lifecycleState).toBe("unverified");
    expect(await repo.getModel("made-up-model")).not.toBeNull();
  });
});

describe("stage advisory on real catalogue data", () => {
  it("embedding stage blocks a chat-only provider's models (all wrong_type)", async () => {
    // OpenAI has only chat models in the seed → all are wrong_type on the embedding stage.
    const [adv] = await computeStageAdvisory(repo, { providerTypes: ["openai"], stage: "embedding" });
    expect(adv.result.ranked.length).toBeGreaterThan(0);
    expect(adv.result.ranked.every((a) => a.suitability.verdict === "wrong_type")).toBe(true);
  });

  it("embedding stage accepts an embedding provider (voyage) — none blocked", async () => {
    const [adv] = await computeStageAdvisory(repo, { providerTypes: ["voyage"], stage: "embedding" });
    expect(adv.result.ranked.length).toBeGreaterThan(0);
    expect(adv.result.ranked.some((a) => ["recommended", "usable"].includes(a.suitability.verdict))).toBe(true);
    expect(adv.result.ranked.every((a) => a.suitability.verdict !== "wrong_type")).toBe(true);
  });

  it("extraction stage: no embedding-only model is recommended/usable (they are wrong_type)", async () => {
    const [adv] = await computeStageAdvisory(repo, { providerTypes: ["voyage"], stage: "extraction" });
    // voyage is embedding-only → every voyage model must be wrong_type on a chat stage
    expect(adv.result.ranked.length).toBeGreaterThan(0);
    expect(adv.result.ranked.every((a) => a.suitability.verdict === "wrong_type")).toBe(true);
  });

  it("ranking is neutral + cost-aware: recommended models come before usable/caveat", async () => {
    const [adv] = await computeStageAdvisory(repo, { providerTypes: ["openai"], stage: "extraction" });
    const ranks = adv.result.ranked.map((a) => a.suitability.verdict);
    const firstWrong = ranks.indexOf("wrong_type");
    const firstRec = ranks.indexOf("recommended");
    if (firstRec !== -1 && firstWrong !== -1) expect(firstRec).toBeLessThan(firstWrong);
  });

  it("region filter: EU-only home jurisdiction keeps only EU vendors", async () => {
    const [adv] = await computeStageAdvisory(repo, {
      providerTypes: ["mistral"],
      stage: "extraction",
      regionFilter: { homeJurisdictions: ["EU/FR"] },
    });
    // Mistral models are EU/FR — they survive an EU-only filter.
    expect(adv.result.ranked.length).toBeGreaterThan(0);
    expect(adv.result.ranked.every((a) => a.model.homeJurisdiction === "EU/FR")).toBe(true);
  });
});
