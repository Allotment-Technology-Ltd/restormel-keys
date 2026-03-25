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
  /** Optional task hint for future switch criteria (passed through; not required for route selection). */
  task?: string;
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

/** Route metadata returned on resolve success (matches dashboard API `contractVersion` 2026-03-26+). */
export interface RouteResolveMetadata {
  id: string;
  environmentId: string;
  workload: string | null;
  stage: string | null;
  enabled: boolean | null;
  version: number | null;
  publishedVersion: number | null;
}

/** Enabled steps in route order on resolve/simulate success (`stepChain`). */
export interface ResolveStepChainEntry {
  stepId: string;
  orderIndex: number;
  providerType: string | null;
  modelId: string | null;
  enabled: boolean;
  selected: boolean;
}

export interface ResolveSuccess {
  ok: true;
  data: {
    contractVersion?: string;
    routeId: string;
    routeName?: string;
    route?: RouteResolveMetadata;
    /** Canonical API provider slug (e.g. `vertex` for Google/Vertex; not the persisted `google` step label). */
    providerType?: string;
    /** Present and non-empty on HTTP 200 resolve success. */
    modelId: string | null;
    explanation: string;
    selectedStepId?: string | null;
    selectedOrderIndex?: number | null;
    switchReasonCode?: string | null;
    estimatedCostUsd?: number | null;
    matchedCriteria?: Record<string, unknown> | null;
    fallbackCandidates?: unknown[];
    stepChain?: ResolveStepChainEntry[];
    decisionMetadata?: Record<string, unknown>;
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
  /** Operator-facing copy for some 422 errors (e.g. `resolve_incomplete`). */
  userMessage?: string;
  violations?: PolicyViolation[];
  data?: Record<string, unknown>;
  routeId?: string;
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

/** POST .../routes/:routeId/validate-binding — server-side preflight only. */
export interface ValidateRouteBindingOptions {
  baseUrl?: string;
  projectId: string;
  routeId: string;
  environmentId: string;
  workload?: string | null;
  stage?: string | null;
  task?: string | null;
  auth: { type: "bearer"; token: string };
  headers?: HeadersInit;
}

export type ValidateRouteBindingSuccess = {
  ok: true;
  /** True when route metadata matches constraints (no structural reasons). */
  bindingOk: boolean;
  reasons: string[];
};

export type ValidateRouteBindingFailure = {
  ok: false;
  status: number;
  error: string;
  message?: string;
  body?: unknown;
};

export type ValidateRouteBindingResult = ValidateRouteBindingSuccess | ValidateRouteBindingFailure;

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
  /** Aggregated reports from authenticated clients via POST .../catalog/observations (contract v4+). */
  crowdObservations?: {
    deprecatedReportCount: number;
    retiredReportCount: number;
    firstReportedAt: string | null;
    lastReportedAt: string | null;
  };
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
  compatibility?: {
    minCliVersion: string;
    minCoreDashboardVersion: string;
    docsUrl: string;
  };
  /**
   * Credential-free signals: OpenRouter public model list metadata + vendor status pages (OpenAI, Anthropic).
   * Present from contract `2026-03-25.catalog.v3` (extended in v4 with variant `crowdObservations`, v5 with `freshness`).
   */
  externalSignals?: {
    /** Staleness SLO: use `allFresh` or per-signal `isFresh` to degrade UI when samples are too old. Contract v5+. */
    freshness?: {
      slo: {
        openRouterModelsMaxAgeMs: number;
        providerStatusMaxAgeMs: number;
        openRouterEndpointHealthMaxAgeMs: number;
      };
      openRouterModels: { isFresh: boolean; ageMs: number; maxAgeMs: number };
      providerStatus: {
        openai: { isFresh: boolean; ageMs: number; maxAgeMs: number };
        anthropic: { isFresh: boolean; ageMs: number; maxAgeMs: number };
      };
      openRouterEndpointHealth: {
        isFresh: boolean;
        maxAgeMs: number;
        maxAgeMsThreshold: number;
        staleModelIds?: string[];
        modelCount: number;
      };
      allFresh: boolean;
    };
    openRouter: {
      source: string;
      ok: boolean;
      modelCount: number;
      fetchedAt: string;
      endpointHealthByModel?: Record<
        string,
        {
          providerModelId: string;
          fetchedAt: string;
          endpointCount: number;
          statuses: string[];
          uptimeLast30m: number | null;
          latencyLast30m: { p50: number | null; p75: number | null; p90: number | null; p99: number | null } | null;
          throughputLast30m: { p50: number | null; p75: number | null; p90: number | null; p99: number | null } | null;
          error?: string;
        }
      >;
      error?: string;
    };
    providerStatus: {
      openai: {
        statusUrl: string;
        ok: boolean;
        indicator: string | null;
        description: string | null;
        fetchedAt: string;
        error?: string;
      };
      anthropic: {
        statusUrl: string;
        ok: boolean;
        indicator: string | null;
        description: string | null;
        fetchedAt: string;
        error?: string;
      };
    };
  };
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
  /** When true, request `skipDefaultAllowlist=1` (include DB rows not in @restormel/keys defaultProviders). For operators only. */
  skipDefaultAllowlist?: boolean;
  headers?: HeadersInit;
}

/** POST /keys/dashboard/api/catalog/observations — authenticated crowd signal (server-side only). */
export interface ReportCatalogModelObservationOptions {
  baseUrl?: string;
  auth: { type: "bearer"; token: string };
  providerId: string;
  providerModelId: string;
  signal: "deprecated" | "retired";
  providerHttpStatus?: number;
  /** Short opaque code only (e.g. provider error type); never raw responses. */
  providerErrorCode?: string;
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
