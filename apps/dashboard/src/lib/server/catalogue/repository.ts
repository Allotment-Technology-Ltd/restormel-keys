/**
 * Store-agnostic catalogue access (advisory plan §3.1 — the decoupling keystone).
 *
 * All new advisory/selection code depends on this interface, never on getSql() directly, so the
 * work ships on Neon today and SNAPS onto the replacement Postgres when the DB migration lands
 * (database-strategy-roadmap). A Neon-backed impl lives alongside the binding API; the in-memory
 * impl here serves tests/previews.
 */
import type { CatalogueModel, CatalogueVariant } from "./types";

export interface RegisterUnverifiedInput {
  id: string;
  providerType: string;
  providerModelId?: string;
}

export interface CatalogueRepository {
  /** Every catalogue model offering a variant on this provider integration. */
  listModelsForProvider(providerType: string): Promise<CatalogueModel[]>;
  /**
   * Distinct provider integration types across the WHOLE catalogue (lowercased, trimmed, sorted).
   * The flat advisory ranks every provider's models — connected or not — so this is the source of
   * the candidate provider set, independent of which providers the user has connected. §3.2
   */
  listProviders(): Promise<string[]>;
  getModel(modelId: string): Promise<CatalogueModel | null>;
  capabilitiesFor(modelId: string): Promise<string[]>;
  variantsFor(modelId: string): Promise<CatalogueVariant[]>;
  /**
   * Register a free-text / discovered model as an `unverified` row (idempotent). §3.4/§3.9 —
   * reuses the existing `registry` binding-kind so policy (`model_allowlist`) can reference it.
   */
  registerUnverifiedModel(input: RegisterUnverifiedInput): Promise<CatalogueModel>;
}

/** In-memory implementation for unit tests and previews (no DB). */
export class InMemoryCatalogueRepository implements CatalogueRepository {
  private readonly models = new Map<string, CatalogueModel>();

  constructor(seed: CatalogueModel[] = []) {
    for (const m of seed) this.models.set(m.id.trim(), m);
  }

  async listModelsForProvider(providerType: string): Promise<CatalogueModel[]> {
    const p = providerType.trim().toLowerCase();
    return [...this.models.values()].filter((m) =>
      (m.variants ?? []).some((v) => v.providerIntegrationType.trim().toLowerCase() === p),
    );
  }

  async listProviders(): Promise<string[]> {
    const providers = new Set<string>();
    for (const m of this.models.values()) {
      for (const v of m.variants ?? []) {
        const p = v.providerIntegrationType.trim().toLowerCase();
        if (p) providers.add(p);
      }
    }
    return [...providers].sort();
  }

  async getModel(modelId: string): Promise<CatalogueModel | null> {
    return this.models.get(modelId.trim()) ?? null;
  }

  async capabilitiesFor(modelId: string): Promise<string[]> {
    return (await this.getModel(modelId))?.capabilities ?? [];
  }

  async variantsFor(modelId: string): Promise<CatalogueVariant[]> {
    return (await this.getModel(modelId))?.variants ?? [];
  }

  async registerUnverifiedModel(input: RegisterUnverifiedInput): Promise<CatalogueModel> {
    const id = input.id.trim();
    const existing = this.models.get(id);
    if (existing) return existing;
    const model: CatalogueModel = {
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
    this.models.set(id, model);
    return model;
  }
}
