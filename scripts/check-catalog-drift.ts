/**
 * Fail if dashboard model-catalog seed does not cover every model offered in
 * @restormel/keys defaultProviders (by canonical catalog id or variant mapping).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultProviders } from "../packages/core/src/providers/defaults.js";
import { CATALOG_DRIFT_SYNC_PROVIDER_IDS } from "../packages/core/src/providers/catalog-drift-scope.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

type SeedVariant = {
  providerIntegrationType: string;
  providerModelId: string;
};

type SeedModel = {
  id: string;
  variants?: SeedVariant[];
};

function loadSeed(): SeedModel[] {
  const path = join(root, "apps/dashboard/data/model-catalog-seed.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as { models: SeedModel[] };
  return raw.models ?? [];
}

function seedCoversProviderModel(
  seed: SeedModel[],
  providerId: string,
  modelId: string
): boolean {
  for (const m of seed) {
    if (m.id === modelId) return true;
    for (const v of m.variants ?? []) {
      if (v.providerIntegrationType === providerId && v.providerModelId === modelId) {
        return true;
      }
    }
  }
  return false;
}

function main(): void {
  const seed = loadSeed();
  const missing: string[] = [];
  const syncSet = new Set<string>(CATALOG_DRIFT_SYNC_PROVIDER_IDS);

  for (const p of defaultProviders) {
    if (!syncSet.has(p.id)) continue;
    for (const modelId of p.models ?? []) {
      if (!seedCoversProviderModel(seed, p.id, modelId)) {
        missing.push(`${p.id}:${modelId}`);
      }
    }
  }

  if (missing.length > 0) {
    console.error(
      "Catalog drift: defaultProviders models (sync scope: " +
        CATALOG_DRIFT_SYNC_PROVIDER_IDS.join(", ") +
        ") not covered by apps/dashboard/data/model-catalog-seed.json:\n" +
        missing.map((m) => `  - ${m}`).join("\n")
    );
    process.exit(1);
  }

  console.log(
    "check-catalog-drift: OK — all default models for " +
      CATALOG_DRIFT_SYNC_PROVIDER_IDS.join(", ") +
      " are represented in model-catalog-seed.json."
  );
}

main();
