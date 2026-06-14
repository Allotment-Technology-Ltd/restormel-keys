/**
 * Model catalogue — core types (advisory plan §3.1/§3.2/§3.3/§3.8).
 *
 * Shape aligned with `apps/dashboard/data/model-catalog-seed.json` and the `models` /
 * `provider_model_variants` tables. Kept store-agnostic so the same types serve the Neon
 * impl today and the replacement-Postgres impl later.
 */
import type { ConnectModelStage } from "@restormel/contracts/connect";

export type { ConnectModelStage };

export type ModelLifecycle = "active" | "deprecated" | "retired" | "unverified";
export type ModelProvenance = "seed" | "discovered" | "user-added";

/** A catalogue model row. */
export interface CatalogueModel {
  id: string;
  canonicalName: string;
  family?: string | null;
  lifecycleState?: ModelLifecycle | string | null;
  description?: string | null;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  supportsTools?: boolean | null;
  supportsStructuredOutput?: boolean | null;
  supportsMcp?: boolean | null;
  modalities?: string[] | null;
  capabilities?: string[] | null;
  editorialSummary?: string | null;
  /** Provenance — `user-added`/`discovered` rows are unverified until reviewed. */
  provenance?: ModelProvenance | null;
  /** Vendor's legal home jurisdiction (e.g. US, EU/FR, UK, CA, CN). §3.8 */
  homeJurisdiction?: string | null;
  variants?: CatalogueVariant[];
}

export interface CatalogueVariant {
  providerIntegrationType: string;
  providerModelId: string;
  availabilityStatus?: string | null;
  pricingRef?: string | null;
  /**
   * Where inference actually runs for this route. For aggregators (Together/Aizolo/
   * OpenRouter) this is the AGGREGATOR's processing region, not the underlying vendor's
   * origin — so the region filter never gives a false sovereignty guarantee. §3.8
   */
  processingRegion?: string | null;
}

/** Five-state suitability verdict per (model, stage). §3.2 */
export type SuitabilityVerdict =
  | "recommended"
  | "usable"
  | "caveat"
  | "unknown"
  | "wrong_type";

export interface StageSuitability {
  verdict: SuitabilityVerdict;
  /** Short, neutral, human-readable reason (no provider favouritism). */
  rationale: string;
  /** True ONLY for `wrong_type` — the picker must disable the option (hard guard). */
  blocked: boolean;
}
