/**
 * Refresh AiZolo rows in model-catalog-seed.json from @restormel/keys AIZOLO_VENDOR_MODEL_IDS.
 * Run from repo root: pnpm -w --filter @restormel/keys run build && node apps/dashboard/scripts/sync-aizolo-catalog-seed.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, "..", "data", "model-catalog-seed.json");
const keysModels = join(__dirname, "..", "..", "..", "packages", "core", "dist", "providers", "aizolo-models.js");

const { AIZOLO_VENDOR_MODEL_IDS, aizoloCatalogModelId } = await import(keysModels);

function modelEntry(vendorId) {
  const id = aizoloCatalogModelId(vendorId);
  return {
    id,
    canonicalName: id,
    family: "aizolo",
    lifecycleState: "active",
    description: `AiZolo API model route: ${vendorId}`,
    contextWindow: 200000,
    maxOutputTokens: 32768,
    supportsTools: false,
    supportsStructuredOutput: false,
    supportsMcp: false,
    modalities: ["text"],
    capabilities: ["chat"],
    editorialSummary: null,
    deprecationDate: null,
    retirementDate: null,
    replacementModelId: null,
    sourceLastVerifiedAt: null,
    variants: [
      {
        providerIntegrationType: "aizolo",
        providerModelId: vendorId,
        availabilityStatus: "available",
        pricingRef: id,
      },
    ],
  };
}

const raw = readFileSync(SEED_PATH, "utf-8");
const seed = JSON.parse(raw);
const aizoloModels = [...AIZOLO_VENDOR_MODEL_IDS].map(modelEntry);
seed.models = seed.models.filter((m) => m.family !== "aizolo");
seed.models.push(...aizoloModels);
seed.lastUpdated = new Date().toISOString().slice(0, 10);
writeFileSync(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`, "utf-8");
console.error(`sync-aizolo-catalog-seed: wrote ${aizoloModels.length} AiZolo models to ${SEED_PATH}`);
