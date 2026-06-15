import { describe, it, expect } from "vitest";
import { SeedCatalogueRepository } from "./seed-repository";
import { computeStageAdvisory, computeFlatStageAdvisory } from "./stage-advisory";
import { serializeStageAdvisory, serializeFlatStageAdvisory } from "./stage-advisory-serialize";

const repo = new SeedCatalogueRepository();

describe("serializeStageAdvisory", () => {
  it("produces a stable, JSON-safe shape with formatted costs", async () => {
    const advisories = await computeStageAdvisory(repo, { providerTypes: ["openai"], stage: "extraction" });
    const out = serializeStageAdvisory(advisories);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out); // fully serializable
    const p = out[0];
    expect(p.provider).toBe("openai");
    expect(p.models.length).toBeGreaterThan(0);
    for (const m of p.models) {
      expect(typeof m.verdict).toBe("string");
      // cost is always a string label — never a raw 0
      expect(typeof m.costPerMillion).toBe("string");
      expect(m.runCost === "cost unknown" || m.runCost.startsWith("~$")).toBe(true);
    }
  });

  it("blocked flag mirrors wrong_type", async () => {
    const advisories = await computeStageAdvisory(repo, { providerTypes: ["voyage"], stage: "extraction" });
    const out = serializeStageAdvisory(advisories);
    // voyage models are embedding-only → all blocked wrong_type on a chat stage
    expect(out[0].models.every((m) => m.blocked && m.verdict === "wrong_type")).toBe(true);
  });
});

describe("serializeFlatStageAdvisory", () => {
  it("produces a JSON-safe flat list carrying provider + connected on every row", async () => {
    const providers = await repo.listProviders();
    const flat = await computeFlatStageAdvisory(repo, {
      stage: "extraction",
      providers,
      connected: new Set(["openai"]),
    });
    const out = serializeFlatStageAdvisory(flat);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out); // fully serializable
    expect(out.models.length).toBeGreaterThan(0);
    expect(typeof out.hiddenByRegion).toBe("number");
    expect(typeof out.hiddenUnknownRegion).toBe("number");
    for (const m of out.models) {
      expect(typeof m.provider).toBe("string");
      expect(typeof m.connected).toBe("boolean");
      expect(typeof m.verdict).toBe("string");
      // cost is always a string label — never a raw 0
      expect(typeof m.costPerMillion).toBe("string");
      expect(m.runCost === "cost unknown" || m.runCost.startsWith("~$")).toBe(true);
    }
    // The connected flag reflects the request set, not provider identity.
    expect(out.models.filter((m) => m.provider === "openai").every((m) => m.connected)).toBe(true);
    expect(out.models.filter((m) => m.provider === "voyage").every((m) => !m.connected)).toBe(true);
  });
});
