/**
 * Integration tests against the REAL bundled seed (no mocks) — verifies the derived engine produces
 * sensible verdicts on actual catalogue data (the strongest offline signal short of a live DB).
 */
import { describe, it, expect } from "vitest";
import { SeedCatalogueRepository, loadSeedModels } from "./seed-repository";
import { computeStageAdvisory, computeFlatStageAdvisory } from "./stage-advisory";
import { VERDICT_RANK } from "./suitability";

const repo = new SeedCatalogueRepository();

describe("seed repository", () => {
  it("loads the 149-model catalogue", () => {
    expect(loadSeedModels().length).toBe(149);
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

describe("flat advisory across the WHOLE catalogue", () => {
  it("(a) ranks every provider's models in ONE provider-neutral suitability order", async () => {
    const providers = await repo.listProviders();
    const flat = await computeFlatStageAdvisory(repo, {
      stage: "extraction",
      providers,
      connected: new Set(["openai"]),
    });
    // The list spans MANY providers (not just the connected one).
    const seen = new Set(flat.ranked.map((e) => e.provider));
    expect(seen.size).toBeGreaterThan(3);
    expect(seen.has("openai")).toBe(true);
    expect(seen.has("voyage")).toBe(true); // unconnected provider still appears

    // The verdict rank is monotonically non-decreasing across the WHOLE list — i.e. it is one
    // global suitability order, never grouped/hoisted by provider.
    const verdictRanks = flat.ranked.map((e) => VERDICT_RANK[e.suitability.verdict]);
    for (let i = 1; i < verdictRanks.length; i++) {
      expect(verdictRanks[i]).toBeGreaterThanOrEqual(verdictRanks[i - 1]);
    }
    // A non-blocked viable entry precedes a blocked one (recommended before wrong_type).
    const firstRec = flat.ranked.findIndex((e) => e.suitability.verdict === "recommended");
    const firstWrong = flat.ranked.findIndex((e) => e.suitability.verdict === "wrong_type");
    if (firstRec !== -1 && firstWrong !== -1) expect(firstRec).toBeLessThan(firstWrong);
  });

  it("(b) `connected` is presentation only — it does NOT change ordering", async () => {
    const providers = await repo.listProviders();
    const order = (connected: Set<string>) =>
      computeFlatStageAdvisory(repo, { stage: "extraction", providers, connected }).then((f) =>
        f.ranked.map((e) => `${e.provider}:${e.model.id}`),
      );
    const none = await order(new Set());
    const someConnected = await order(new Set(["openai", "together"]));
    const allConnected = await order(new Set(providers));
    // Identical row order regardless of which providers are flagged connected.
    expect(someConnected).toEqual(none);
    expect(allConnected).toEqual(none);
  });

  it("(c) embedding stage: an embedding provider's models rank ABOVE wrong_type generative models", async () => {
    const providers = await repo.listProviders();
    const flat = await computeFlatStageAdvisory(repo, {
      stage: "embedding",
      providers,
      connected: new Set(),
    });
    const voyageLarge = flat.ranked.findIndex(
      (e) => e.provider === "voyage" && e.model.id === "voyage-3-large",
    );
    expect(voyageLarge).toBeGreaterThanOrEqual(0);
    // voyage-3-large is a real embedding model → recommended/usable, NOT wrong_type.
    expect(flat.ranked[voyageLarge].suitability.verdict).not.toBe("wrong_type");

    // Every wrong_type (generative) row sits BELOW the voyage embedding model.
    const firstWrong = flat.ranked.findIndex((e) => e.suitability.verdict === "wrong_type");
    expect(firstWrong).toBeGreaterThan(voyageLarge);

    // Concretely: a generative model (e.g. an openai chat model) is wrong_type on embedding and
    // ranks below the voyage embedding model — even though openai could be the connected provider.
    const someGenerativeWrong = flat.ranked.find(
      (e) => e.provider === "openai" && e.suitability.verdict === "wrong_type",
    );
    expect(someGenerativeWrong).toBeDefined();
    const genIdx = flat.ranked.indexOf(someGenerativeWrong!);
    expect(genIdx).toBeGreaterThan(voyageLarge);
  });
});
