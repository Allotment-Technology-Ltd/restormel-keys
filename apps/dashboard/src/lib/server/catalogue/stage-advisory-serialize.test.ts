import { describe, it, expect } from "vitest";
import { SeedCatalogueRepository } from "./seed-repository";
import { computeStageAdvisory } from "./stage-advisory";
import { serializeStageAdvisory } from "./stage-advisory-serialize";

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
