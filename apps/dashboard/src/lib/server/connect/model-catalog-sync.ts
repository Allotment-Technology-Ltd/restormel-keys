/**
 * Upsert model catalog rows from data/model-catalog-seed.json into Postgres.
 * Idempotent — safe to call before route setup so 2026 models appear in the route builder.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogSeedEpochMs } from "$lib/server/catalog-seed-epoch";
import { getSql } from "$lib/server/neon";

type SeedVariant = {
  providerIntegrationType: string;
  providerModelId: string;
  availabilityStatus?: string | null;
  /** Where inference actually runs for this route (§3.8). Null = unverified (e.g. Aizolo). */
  processingRegion?: string | null;
  pricingRef?: string | null;
  rateLimitRef?: string | null;
  sourceLastVerifiedAt?: string | null;
};

type SeedModel = {
  id: string;
  canonicalName: string;
  family?: string | null;
  lifecycleState?: string | null;
  description?: string | null;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  supportsTools?: boolean | null;
  supportsStructuredOutput?: boolean | null;
  supportsMcp?: boolean | null;
  modalities?: string[] | null;
  capabilities?: string[] | null;
  editorialSummary?: string | null;
  /** Vendor's legal home jurisdiction (§3.8). Null = unresolvable from seed data. */
  homeJurisdiction?: string | null;
  deprecationDate?: string | null;
  retirementDate?: string | null;
  replacementModelId?: string | null;
  sourceLastVerifiedAt?: string | null;
  variants?: SeedVariant[];
};

type SeedFile = { models: SeedModel[]; lastUpdated?: string | null };

/** Resolved from module path so sync works regardless of process cwd (Vite dev, Vercel, workers). */
const SEED_PATH = join(
  fileURLToPath(new URL("../../../../data/model-catalog-seed.json", import.meta.url)),
);

let lastSyncMs = 0;
let lastSyncedSeedUpdated: string | null = null;
const SYNC_TTL_MS = 5 * 60 * 1000;

function loadSeed(): SeedFile {
  const raw = readFileSync(SEED_PATH, "utf8");
  return JSON.parse(raw) as SeedFile;
}

async function upsertSeedModels(models: SeedModel[]): Promise<number> {
  const sql = getSql();
  let count = 0;
  for (const m of models) {
    const modalities = m.modalities ? JSON.stringify(m.modalities) : null;
    const capabilities = m.capabilities ? JSON.stringify(m.capabilities) : null;
    await sql`
      INSERT INTO models (
        id, canonical_name, family, lifecycle_state, description,
        context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
        modalities, capabilities, editorial_summary,
        home_jurisdiction,
        deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
      ) VALUES (
        ${m.id}, ${m.canonicalName}, ${m.family ?? null}, ${m.lifecycleState ?? null}, ${m.description ?? null},
        ${m.contextWindow ?? null}, ${m.maxOutputTokens ?? null}, ${m.supportsTools ?? null}, ${m.supportsStructuredOutput ?? null}, ${m.supportsMcp ?? null},
        ${modalities}, ${capabilities}, ${m.editorialSummary ?? null},
        ${m.homeJurisdiction ?? null},
        ${catalogSeedEpochMs(m.deprecationDate)}, ${catalogSeedEpochMs(m.retirementDate)}, ${m.replacementModelId ?? null}, ${catalogSeedEpochMs(m.sourceLastVerifiedAt)}
      )
      ON CONFLICT (id) DO UPDATE SET
        canonical_name = EXCLUDED.canonical_name,
        family = EXCLUDED.family,
        lifecycle_state = EXCLUDED.lifecycle_state,
        description = EXCLUDED.description,
        context_window = EXCLUDED.context_window,
        max_output_tokens = EXCLUDED.max_output_tokens,
        supports_tools = EXCLUDED.supports_tools,
        supports_structured_output = EXCLUDED.supports_structured_output,
        supports_mcp = EXCLUDED.supports_mcp,
        modalities = EXCLUDED.modalities,
        capabilities = EXCLUDED.capabilities,
        editorial_summary = EXCLUDED.editorial_summary,
        home_jurisdiction = EXCLUDED.home_jurisdiction,
        deprecation_date = EXCLUDED.deprecation_date,
        retirement_date = EXCLUDED.retirement_date,
        replacement_model_id = EXCLUDED.replacement_model_id,
        source_last_verified_at = EXCLUDED.source_last_verified_at
    `;
    count += 1;
    if (!m.variants?.length) continue;
    for (const v of m.variants) {
      const variantId = `${m.id}-${v.providerIntegrationType}`;
      await sql`
        INSERT INTO provider_model_variants (
          id, model_id, provider_integration_type, provider_model_id,
          availability_status, processing_region, pricing_ref, rate_limit_ref, source_last_verified_at,
          catalog_provider_id
        ) VALUES (
          ${variantId}, ${m.id}, ${v.providerIntegrationType}, ${v.providerModelId},
          ${v.availabilityStatus ?? null}, ${v.processingRegion ?? null}, ${v.pricingRef ?? null}, ${v.rateLimitRef ?? null}, ${catalogSeedEpochMs(v.sourceLastVerifiedAt)},
          ${v.providerIntegrationType}
        )
        ON CONFLICT (id) DO UPDATE SET
          provider_model_id = EXCLUDED.provider_model_id,
          availability_status = EXCLUDED.availability_status,
          processing_region = EXCLUDED.processing_region,
          pricing_ref = EXCLUDED.pricing_ref,
          rate_limit_ref = EXCLUDED.rate_limit_ref,
          source_last_verified_at = EXCLUDED.source_last_verified_at,
          catalog_provider_id = EXCLUDED.catalog_provider_id
      `;
    }
  }
  return count;
}

/** Sync seed catalog into DB; skips if synced within TTL unless force=true or seed lastUpdated changed. */
export function getModelCatalogSeedVersion(): string {
  try {
    const seed = loadSeed();
    return seed.lastUpdated?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export async function ensureModelCatalogSynced(force = false): Promise<{ synced: boolean; modelCount: number }> {
  const now = Date.now();
  const seed = loadSeed();
  const seedUpdated = seed.lastUpdated?.trim() || null;
  const seedChanged = Boolean(seedUpdated && seedUpdated !== lastSyncedSeedUpdated);
  if (!force && !seedChanged && now - lastSyncMs < SYNC_TTL_MS) {
    return { synced: false, modelCount: 0 };
  }
  const modelCount = await upsertSeedModels(seed.models ?? []);
  lastSyncMs = now;
  lastSyncedSeedUpdated = seedUpdated;
  return { synced: true, modelCount };
}
