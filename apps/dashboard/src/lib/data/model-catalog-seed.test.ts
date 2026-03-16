/**
 * Validation tests for the model catalog seed JSON.
 * Seed file: apps/dashboard/data/model-catalog-seed.json (relative to dashboard root).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SEED_PATH = join(process.cwd(), "data", "model-catalog-seed.json");

function loadSeed() {
  const raw = readFileSync(SEED_PATH, "utf-8");
  return JSON.parse(raw);
}

describe("model-catalog-seed.json", () => {
  it("loads and has models array", () => {
    const seed = loadSeed();
    expect(seed).toBeDefined();
    expect(Array.isArray(seed.models)).toBe(true);
    expect(seed.models.length).toBeGreaterThan(0);
  });

  it("every model has required id and canonicalName", () => {
    const seed = loadSeed();
    for (const m of seed.models) {
      expect(m.id, `model missing id: ${JSON.stringify(m)}`).toBeDefined();
      expect(typeof m.id).toBe("string");
      expect(m.canonicalName, `model missing canonicalName: ${m.id}`).toBeDefined();
      expect(typeof m.canonicalName).toBe("string");
    }
  });

  it("every variant has required providerIntegrationType and providerModelId", () => {
    const seed = loadSeed();
    for (const m of seed.models) {
      if (!m.variants || !Array.isArray(m.variants)) continue;
      for (let i = 0; i < m.variants.length; i++) {
        const v = m.variants[i];
        expect(
          v.providerIntegrationType,
          `model ${m.id} variant ${i} missing providerIntegrationType`
        ).toBeDefined();
        expect(typeof v.providerIntegrationType).toBe("string");
        expect(v.providerModelId, `model ${m.id} variant ${i} missing providerModelId`).toBeDefined();
        expect(typeof v.providerModelId).toBe("string");
      }
    }
  });

  it("lifecycleState when present is a known value", () => {
    const allowed = new Set(["active", "preview", "beta", "deprecated", "retired"]);
    const seed = loadSeed();
    for (const m of seed.models) {
      if (m.lifecycleState != null) {
        expect(
          allowed.has(m.lifecycleState),
          `model ${m.id} has unknown lifecycleState: ${m.lifecycleState}`
        ).toBe(true);
      }
    }
  });
});
