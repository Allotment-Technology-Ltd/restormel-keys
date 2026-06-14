/**
 * Offline seed-hygiene assertions for model-catalog-seed.json (advisory plan §3.8).
 *
 * Guards:
 *  1. Every model has a `homeJurisdiction` key (string OR explicit null — never absent).
 *  2. Every variant has a `processingRegion` key (string OR explicit null — never absent).
 *  3. Capability hygiene: a model tagged with an embedding capability must not also carry any
 *     chat-pipeline capability, and vice-versa.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, "../../../../data/model-catalog-seed.json");

// ---------------------------------------------------------------------------
// Capability sets (advisory plan §3.3)
// ---------------------------------------------------------------------------

/** Capabilities that indicate a pure embedding / vector-index model. */
const EMBEDDING_CAPS = new Set(["embedding", "ingestion_embedding"]);

/** Capabilities that indicate a chat / generation pipeline model. */
const CHAT_CAPS = new Set([
  "chat",
  "tools",
  "ingestion_extraction",
  "ingestion_grouping",
  "ingestion_validation",
  "ingestion_remediation",
]);

// ---------------------------------------------------------------------------
// Load seed
// ---------------------------------------------------------------------------

interface SeedVariant {
  providerIntegrationType: string;
  providerModelId: string;
  availabilityStatus?: string | null;
  processingRegion?: string | null;
  pricingRef?: string | null;
}

interface SeedModel {
  id: string;
  canonicalName: string;
  family?: string | null;
  capabilities?: string[] | null;
  homeJurisdiction?: string | null;
  variants?: SeedVariant[];
  [key: string]: unknown;
}

interface SeedFile {
  models: SeedModel[];
}

function loadSeed(): SeedFile {
  const raw = readFileSync(SEED_PATH, "utf-8");
  return JSON.parse(raw) as SeedFile;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("model-catalog-seed.json — region facet hygiene (§3.8)", () => {
  const seed = loadSeed();
  const models = seed.models;

  it("seed.models is a non-empty array", () => {
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it("every model has a homeJurisdiction key (string OR explicit null)", () => {
    const missing: string[] = [];
    for (const m of models) {
      if (!Object.prototype.hasOwnProperty.call(m, "homeJurisdiction")) {
        missing.push(m.id);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `${missing.length} model(s) missing homeJurisdiction key:\n  ${missing.join("\n  ")}`,
      );
    }
  });

  it("every variant has a processingRegion key (string OR explicit null)", () => {
    const missing: string[] = [];
    for (const m of models) {
      for (const v of m.variants ?? []) {
        if (!Object.prototype.hasOwnProperty.call(v, "processingRegion")) {
          missing.push(`${m.id} [${v.providerIntegrationType}]`);
        }
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `${missing.length} variant(s) missing processingRegion key:\n  ${missing.join("\n  ")}`,
      );
    }
  });
});

describe("model-catalog-seed.json — capability hygiene (§3.3)", () => {
  const seed = loadSeed();
  const models = seed.models;

  it("no model mixes embedding and chat capabilities", () => {
    const offenders: string[] = [];
    for (const m of models) {
      const caps = new Set(m.capabilities ?? []);
      const hasEmbedding = [...EMBEDDING_CAPS].some((c) => caps.has(c));
      const hasChat = [...CHAT_CAPS].some((c) => caps.has(c));
      if (hasEmbedding && hasChat) {
        offenders.push(
          `${m.id} (capabilities: ${[...caps].join(", ")})`,
        );
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `${offenders.length} model(s) illegally mix embedding and chat capabilities:\n  ${offenders.join("\n  ")}`,
      );
    }
  });
});
