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

/** KeyManager surface state for host wiring (empty / credential list / add flow). */
export type KeyManagerHostStatus = "empty" | "list" | "entry";

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
  /** Host hook: empty list, list+detail, or add-credential dialog. */
  onStatusChange?: (status: KeyManagerHostStatus, message?: string) => void;
  /**
   * When true (default), removing a credential requires explicit browser confirmation.
   * Set false only for controlled hosts that implement their own confirmation.
   */
  requireRemoveConfirm?: boolean;
}

/** Host-visible ModelSelector lifecycle (includes degraded when nothing is selectable). */
export type ModelSelectorHostStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "degraded";

/** Props for the ModelSelector component. */
export interface ModelSelectorProps {
  keys: KeysInstance;
  providers: ProviderDefinition[];
  onSelect?: (modelId: string, providerId: string) => void;
  /** Called when loading/ready/error/empty/degraded state changes. Use for host banners and retry. */
  onStatusChange?: (status: ModelSelectorHostStatus, message?: string) => void;
  /** Override message when Restormel backend is unavailable. Default uses RESTORMEL_BACKEND_ERROR_MESSAGE. */
  errorMessage?: string;
  /** Override message when no providers/models (empty state). */
  emptyMessage?: string;
  /** Server-built policy map (`providerId:modelId`); blocked rows skip resolve. */
  policyAvailability?: Record<string, { available: boolean; reason?: string }> | null;
  /** Bump from host to force reload (e.g. after policy refresh). */
  retryNonce?: number;
  onRetry?: () => void;
}

/** @deprecated Use ModelSelectorHostStatus */
export type ModelSelectorStatus = ModelSelectorHostStatus;

/** Props for the CostEstimator component. */
export interface CostEstimatorProps {
  cost: CostEstimateResult | null;
  budget?: number;
  estimatedCost?: number;
}

/** Message shown when Restormel backend/config is unavailable. Use in host UI for consistency. */
export const RESTORMEL_BACKEND_ERROR_MESSAGE =
  "Restormel backend unavailable. Check RESTORMEL_* configuration.";
