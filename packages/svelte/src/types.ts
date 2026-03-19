/**
 * Strong typings for @restormel/keys-svelte components.
 * Use these for typed integration instead of generic SvelteComponent.
 */
import type { KeysInstance } from "@restormel/keys";
import type {
  KeyConfig,
  KeyRecord,
  KeyAddResult,
  KeyRemoveResult,
  ProviderDefinition,
  ProviderValidationResult,
  CostEstimateResult,
} from "@restormel/keys";

/** Props for the KeyManager component. */
export interface KeyManagerProps {
  keys: KeysInstance;
  userId: string;
  onKeyAdded?: (
    key: KeyConfig,
    rawCredential?: string
  ) => void | KeyAddResult | Promise<void | KeyAddResult>;
  onKeyRemoved?: (keyId: string) => void | KeyRemoveResult | Promise<void | KeyRemoveResult>;
  onValidate?: (provider: string, rawCredential: string) => Promise<ProviderValidationResult>;
  onRevalidate?: (keyId: string, provider: string) => Promise<ProviderValidationResult>;
  providers?: ProviderDefinition[];
}

/** Props for the ModelSelector component. */
export interface ModelSelectorProps {
  keys: KeysInstance;
  providers: ProviderDefinition[];
  onSelect?: (modelId: string, providerId: string) => void;
  /** Called when loading/ready/error/empty state changes. Use for host UI (e.g. retry, degraded banner). */
  onStatusChange?: (
    status: "loading" | "ready" | "error" | "empty",
    message?: string
  ) => void;
  /** Override message when Restormel backend is unavailable. Default uses RESTORMEL_BACKEND_ERROR_MESSAGE. */
  errorMessage?: string;
  /** Override message when no providers/models (empty state). */
  emptyMessage?: string;
}

/** Status of the ModelSelector (loading, ready, error, empty). */
export type ModelSelectorStatus = "loading" | "ready" | "error" | "empty";

/** Props for the CostEstimator component. */
export interface CostEstimatorProps {
  cost: CostEstimateResult | null;
  budget?: number;
  estimatedCost?: number;
}

/** Message shown when Restormel backend/config is unavailable. Use in host UI for consistency. */
export const RESTORMEL_BACKEND_ERROR_MESSAGE =
  "Restormel backend unavailable. Check RESTORMEL_* configuration.";
