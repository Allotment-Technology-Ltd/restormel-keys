/**
 * CatalogueRepository backed by the live operational DB (advisory plan §3.1 — the deferred Phase-1
 * swap). Reads the synced catalogue (`models` + `provider_model_variants`, incl. the migration-068
 * region facets) so the advisory sees discovered/registered models the bundled seed never had.
 *
 * Store seam: this is the DB-backed sibling of {@link SeedCatalogueRepository}. The DB read layer
 * (neon.ts `listModels` / `listProviderModelVariantsByModelIds`) is injected so the unit test can run
 * hermetically (no Postgres). Production constructs it with `new DbCatalogueRepository()` and the
 * defaults wire straight to neon.ts.
 *
 * Resilience: if the DB returns zero models (unsynced / empty / offline replica), every read falls
 * back to the seed so the advisory never goes blank. The fallback is logged once it engages.
 */
import { getSql } from "../neon";
import {
  listModels as defaultListModels,
  listProviderModelVariantsByModelIds as defaultListVariantsByModelIds,
  type ModelRecord,
  type ProviderModelVariantRecord,
} from "../neon";
import type { CatalogueRepository, RegisterUnverifiedInput } from "./repository";
import { SeedCatalogueRepository } from "./seed-repository";
import type { CatalogueModel, CatalogueVariant } from "./types";

/** DB read/write seam — injected in tests, defaults to the real neon.ts functions in production. */
export interface DbCatalogueDeps {
  listModels: typeof defaultListModels;
  listProviderModelVariantsByModelIds: typeof defaultListVariantsByModelIds;
  /** Distinct lowercased provider integration types across all variants. */
  listVariantProviderTypes: () => Promise<string[]>;
  /** Idempotent upsert of an `unverified` model row + a variant. */
  registerUnverified: (input: RegisterUnverifiedInput) => Promise<void>;
}

async function defaultListVariantProviderTypes(): Promise<string[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT LOWER(TRIM(provider_integration_type)) AS provider
    FROM provider_model_variants
    WHERE provider_integration_type IS NOT NULL AND TRIM(provider_integration_type) <> ''
    ORDER BY provider ASC
  `) as Array<Record<string, unknown>>;
  return rows.map((r) => String(r.provider)).filter(Boolean);
}

async function defaultRegisterUnverified(input: RegisterUnverifiedInput): Promise<void> {
  const sql = getSql();
  const id = input.id.trim();
  const providerType = input.providerType.trim();
  const providerModelId = (input.providerModelId ?? id).trim();
  const now = Date.now();
  // Idempotent: keep an existing verified row's lifecycle, but ensure the row + variant exist.
  await sql`
    INSERT INTO models (id, canonical_name, lifecycle_state, source_last_verified_at)
    VALUES (${id}, ${id}, 'unverified', ${now})
    ON CONFLICT (id) DO NOTHING
  `;
  const variantId = `${id}-${providerType}`;
  await sql`
    INSERT INTO provider_model_variants (
      id, model_id, provider_integration_type, provider_model_id, catalog_provider_id, source_last_verified_at
    ) VALUES (
      ${variantId}, ${id}, ${providerType}, ${providerModelId}, ${providerType}, ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      provider_model_id = EXCLUDED.provider_model_id,
      source_last_verified_at = EXCLUDED.source_last_verified_at
  `;
}

const DEFAULT_DEPS: DbCatalogueDeps = {
  listModels: defaultListModels,
  listProviderModelVariantsByModelIds: defaultListVariantsByModelIds,
  listVariantProviderTypes: defaultListVariantProviderTypes,
  registerUnverified: defaultRegisterUnverified,
};

function mapVariant(v: ProviderModelVariantRecord): CatalogueVariant {
  return {
    providerIntegrationType: v.providerIntegrationType,
    providerModelId: v.providerModelId,
    availabilityStatus: v.availabilityStatus ?? null,
    processingRegion: v.processingRegion ?? null,
    pricingRef: v.pricingRef ?? null,
  };
}

/** Map a DB `ModelRecord` (+ its variant rows) to the store-agnostic `CatalogueModel`. */
function mapModel(m: ModelRecord, variants: ProviderModelVariantRecord[]): CatalogueModel {
  // `provenance` is not surfaced by the DB schema today (no `provenance` column on `models`); the
  // type leaves it optional, so DB-sourced rows simply omit it rather than fabricate a value.
  const provenance = (m as ModelRecord & { provenance?: string | null }).provenance ?? undefined;
  return {
    id: m.id,
    canonicalName: m.canonicalName,
    family: m.family ?? null,
    lifecycleState: m.lifecycleState ?? null,
    description: m.description ?? null,
    contextWindow: m.contextWindow ?? null,
    maxOutputTokens: m.maxOutputTokens ?? null,
    supportsTools: m.supportsTools ?? null,
    supportsStructuredOutput: m.supportsStructuredOutput ?? null,
    supportsMcp: m.supportsMcp ?? null,
    modalities: m.modalities ?? null,
    capabilities: m.capabilities ?? null,
    editorialSummary: m.editorialSummary ?? null,
    homeJurisdiction: m.homeJurisdiction ?? null,
    ...(provenance != null ? { provenance: provenance as CatalogueModel["provenance"] } : {}),
    variants: variants.map(mapVariant),
  };
}

export class DbCatalogueRepository implements CatalogueRepository {
  private readonly deps: DbCatalogueDeps;
  private seedFallback: SeedCatalogueRepository | null = null;
  private warnedFallback = false;

  constructor(deps: Partial<DbCatalogueDeps> = {}) {
    this.deps = { ...DEFAULT_DEPS, ...deps };
  }

  /** Lazily build (once) the seed repository used as the empty-DB fallback. */
  private seed(): SeedCatalogueRepository {
    if (!this.seedFallback) this.seedFallback = new SeedCatalogueRepository();
    return this.seedFallback;
  }

  private fellBack(reason: string): SeedCatalogueRepository {
    if (!this.warnedFallback) {
      this.warnedFallback = true;
      console.warn(`[catalogue] DbCatalogueRepository falling back to seed (${reason})`);
    }
    return this.seed();
  }

  /** Load every catalogue model fully populated with ALL its variants. */
  private async loadAllModels(): Promise<CatalogueModel[] | null> {
    const records = await this.deps.listModels({ includeUnhealthy: true, limit: 500 });
    if (records.length === 0) return null;
    const ids = records.map((m) => m.id);
    const variants = await this.deps.listProviderModelVariantsByModelIds(ids);
    const byModel = new Map<string, ProviderModelVariantRecord[]>();
    for (const v of variants) {
      const list = byModel.get(v.modelId) ?? [];
      list.push(v);
      byModel.set(v.modelId, list);
    }
    return records.map((m) => mapModel(m, byModel.get(m.id) ?? []));
  }

  async listModelsForProvider(providerType: string): Promise<CatalogueModel[]> {
    const all = await this.loadAllModels();
    if (!all) return this.fellBack("empty models table").listModelsForProvider(providerType);
    const p = providerType.trim().toLowerCase();
    // Models having a variant on `p`, each carrying ALL its variants (cross-provider cost/region).
    return all.filter((m) =>
      (m.variants ?? []).some((v) => v.providerIntegrationType.trim().toLowerCase() === p),
    );
  }

  async listProviders(): Promise<string[]> {
    const providers = await this.deps.listVariantProviderTypes();
    if (providers.length === 0) return this.fellBack("no provider variants").listProviders();
    // Already lowercased + sorted by SQL; de-dup defensively and re-sort to match the seed contract.
    return [...new Set(providers.map((p) => p.trim().toLowerCase()).filter(Boolean))].sort();
  }

  async getModel(modelId: string): Promise<CatalogueModel | null> {
    const all = await this.loadAllModels();
    if (!all) return this.fellBack("empty models table").getModel(modelId);
    const id = modelId.trim();
    return all.find((m) => m.id.trim() === id) ?? null;
  }

  async capabilitiesFor(modelId: string): Promise<string[]> {
    return (await this.getModel(modelId))?.capabilities ?? [];
  }

  async variantsFor(modelId: string): Promise<CatalogueVariant[]> {
    return (await this.getModel(modelId))?.variants ?? [];
  }

  async registerUnverifiedModel(input: RegisterUnverifiedInput): Promise<CatalogueModel> {
    const existing = await this.getModel(input.id);
    if (existing) return existing;
    await this.deps.registerUnverified(input);
    const created = await this.getModel(input.id);
    if (created) return created;
    // Best-effort shape if the read-back is unavailable (e.g. seed-fallback path): mirror the
    // in-memory repository's unverified shape so callers get a consistent model.
    const id = input.id.trim();
    return {
      id,
      canonicalName: id,
      lifecycleState: "unverified",
      provenance: "user-added",
      capabilities: [],
      variants: [
        {
          providerIntegrationType: input.providerType,
          providerModelId: input.providerModelId ?? id,
        },
      ],
    };
  }
}
