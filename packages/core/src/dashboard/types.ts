/**
 * Types for the Restormel dashboard resolve and evaluate APIs.
 * Use from server-side only; never send Gateway Key to the browser.
 */

export interface ResolveOptions {
  /** Base URL of the Restormel dashboard (e.g. https://restormel.dev). Default from env RESTORMEL_KEYS_BASE. */
  baseUrl?: string;
  projectId: string;
  environmentId: string;
  routeId?: string;
  /** Stage-aware resolve: pick the active route bound to this stage/workload. */
  stage?: string;
  workload?: string;
  /** Switch-aware resolve: caller can provide attempt number and previous failure context. */
  attemptNumber?: number;
  previousFailure?: { selectedOrderIndex?: number; selectedStepId?: string | null };
  failureKind?: string;
  /** Optional request context for simulation / cost-aware switching (if supported). */
  estimatedInputTokens?: number;
  estimatedInputChars?: number;
  complexity?: string;
  latencyPreference?: string;
  maxCostUsd?: number;
  /** Auth: Bearer token (Gateway Key or session). Caller must provide; never hardcode. */
  auth: { type: "bearer"; token: string };
  /** Optional fetch init (e.g. custom headers). */
  headers?: HeadersInit;
}

export interface ResolveSuccess {
  ok: true;
  data: {
    routeId: string;
    providerType?: string;
    modelId: string | null;
    explanation: string;
    selectedStepId?: string | null;
    selectedOrderIndex?: number | null;
    switchReasonCode?: string | null;
  };
}

export interface PolicyViolation {
  policyId: string;
  policyName: string;
  type: string;
  message: string;
}

export interface ResolveErrorBody {
  error: string;
  message?: string;
  violations?: PolicyViolation[];
  data?: Record<string, unknown>;
}

/** Discriminated error result: known error codes with optional body. */
export interface ResolveError {
  ok: false;
  status: number;
  error: string;
  message?: string;
  violations?: PolicyViolation[];
  body?: ResolveErrorBody;
}

export type ResolveResult = ResolveSuccess | ResolveError;

export interface EvaluateOptions {
  baseUrl?: string;
  projectId: string;
  environmentId?: string;
  routeId?: string;
  modelId?: string;
  providerType?: string;
  modelLifecycleState?: string;
  auth: { type: "bearer"; token: string };
  headers?: HeadersInit;
}

export interface EvaluateResult {
  allowed: boolean;
  violations: PolicyViolation[];
}

/** Thrown when evaluate returns non-2xx; includes status and parsed body when JSON. */
export type RestormelApiError = Error & {
  status: number;
  error: string;
  message: string;
  violations?: PolicyViolation[];
  body?: unknown;
};

export interface CatalogProviderValidation {
  mode: "native" | "openai_compatible" | "none";
  requiresBaseUrl: boolean;
  requiresModel: boolean;
  /**
   * When `mode === "openai_compatible"` and `requiresBaseUrl === false`, the canonical public
   * OpenAI-compatible API base (e.g. `https://api.together.xyz/v1`). Omitted when the host must
   * supply a base URL (`requiresBaseUrl === true`, e.g. Azure/custom).
   */
  defaultApiBaseUrl?: string;
}

export interface CatalogProvider {
  id: string;
  displayName: string;
  modelCount: number;
  validation: CatalogProviderValidation;
}

export interface CatalogVariant {
  id: string;
  providerType: string;
  providerModelId: string;
  availabilityStatus: string | null;
}

export interface CatalogModel {
  id: string;
  canonicalName: string;
  family: string | null;
  lifecycleState: string | null;
  providerTypes: string[];
  variants: CatalogVariant[];
}

export interface CanonicalCatalogResponse {
  contractVersion: string;
  source: "restormel-keys";
  generatedAt: string;
  providers: CatalogProvider[];
  data: CatalogModel[];
  paging: { limit: number; offset: number; count: number };
}

export interface FetchCanonicalCatalogOptions {
  baseUrl?: string;
  lifecycleState?: string;
  family?: string;
  limit?: number;
  offset?: number;
  /** When true, request `includeUnhealthy=1` (deprecated models, non-available variants). For operators only. */
  includeUnhealthy?: boolean;
  headers?: HeadersInit;
}

export interface FilterCanonicalCatalogOptions {
  /** Keep deprecated/retired model rows when true. Default false. */
  includeDeprecatedOrRetiredModels?: boolean;
  /** Keep non-available variants when true. Default false. */
  includeUnavailableVariants?: boolean;
  /** Additional model ids to suppress even when otherwise "active". */
  knownRetiredModelIds?: string[];
}
