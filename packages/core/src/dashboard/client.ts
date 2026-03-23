/**
 * Typed client for Restormel dashboard resolve and evaluate APIs.
 * Server-side only: pass Gateway Key or session token from env; never expose in browser.
 */
import type {
  ResolveOptions,
  ResolveResult,
  ResolveSuccess,
  ResolveError,
  ResolveErrorBody,
  EvaluateOptions,
  EvaluateResult,
  PolicyViolation,
  RestormelApiError,
  CanonicalCatalogResponse,
  FetchCanonicalCatalogOptions,
  FilterCanonicalCatalogOptions,
} from "./types.js";
import type { ProviderDefinition } from "../providers/types.js";

const DEFAULT_BASE = "https://restormel.dev";
const NON_VIABLE_LIFECYCLE_STATES = new Set(["deprecated", "retired"]);
const VIABLE_VARIANT_STATUSES = new Set(["available"]);

function getBaseUrl(baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/$/, "");
  if (typeof process !== "undefined" && process.env?.RESTORMEL_KEYS_BASE) {
    return process.env.RESTORMEL_KEYS_BASE.replace(/\/$/, "");
  }
  return DEFAULT_BASE;
}

function normalizeCatalogValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isViableLifecycleState(lifecycleState: string | null): boolean {
  const normalized = normalizeCatalogValue(lifecycleState);
  if (!normalized) return true;
  return !NON_VIABLE_LIFECYCLE_STATES.has(normalized);
}

function isViableVariantStatus(availabilityStatus: string | null): boolean {
  return VIABLE_VARIANT_STATUSES.has(normalizeCatalogValue(availabilityStatus));
}

/**
 * Fetch the canonical Restormel provider+model catalog for BYOK UIs.
 * Use this as your source of truth instead of hardcoded provider/model presets.
 */
export async function fetchCanonicalCatalog(
  options: FetchCanonicalCatalogOptions = {}
): Promise<CanonicalCatalogResponse> {
  const base = getBaseUrl(options.baseUrl);
  const url = new URL(`${base}/keys/dashboard/api/catalog`);
  if (options.lifecycleState) url.searchParams.set("lifecycleState", options.lifecycleState);
  if (options.family) url.searchParams.set("family", options.family);
  if (options.limit != null) url.searchParams.set("limit", String(options.limit));
  if (options.offset != null) url.searchParams.set("offset", String(options.offset));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: options.headers,
  });
  const body = (await res.json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(
      typeof body.error === "string" ? body.error : `catalog HTTP ${res.status}`
    ) as RestormelApiError;
    err.status = res.status;
    err.error = typeof body.error === "string" ? body.error : "unknown";
    err.body = body;
    throw err;
  }
  return body as unknown as CanonicalCatalogResponse;
}

/**
 * Filter canonical catalog data to the models/variants safe to render for BYOK selectors.
 * Default behavior:
 * - removes deprecated/retired models
 * - keeps only variants marked `available`
 * - drops models with no remaining variants
 * - drops providers with no remaining models
 */
export function filterCanonicalCatalogForViability(
  catalog: CanonicalCatalogResponse,
  options: FilterCanonicalCatalogOptions = {}
): CanonicalCatalogResponse {
  const blockedModelIds = new Set((options.knownRetiredModelIds ?? []).map((id) => id.trim().toLowerCase()));
  const includeDeprecatedOrRetiredModels = Boolean(options.includeDeprecatedOrRetiredModels);
  const includeUnavailableVariants = Boolean(options.includeUnavailableVariants);

  const data = catalog.data
    .filter((model) => {
      if (blockedModelIds.has(model.id.trim().toLowerCase())) return false;
      if (includeDeprecatedOrRetiredModels) return true;
      return isViableLifecycleState(model.lifecycleState);
    })
    .map((model) => {
      const variants = includeUnavailableVariants
        ? model.variants
        : model.variants.filter((variant) => isViableVariantStatus(variant.availabilityStatus));
      const providerTypes = Array.from(new Set(variants.map((variant) => variant.providerType))).sort();
      return {
        ...model,
        variants,
        providerTypes,
      };
    })
    .filter((model) => includeUnavailableVariants || model.variants.length > 0);

  const providerCounts = new Map<string, number>();
  for (const model of data) {
    for (const providerType of model.providerTypes) {
      providerCounts.set(providerType, (providerCounts.get(providerType) ?? 0) + 1);
    }
  }

  const providers = catalog.providers
    .filter((provider) => providerCounts.has(provider.id))
    .map((provider) => ({
      ...provider,
      modelCount: providerCounts.get(provider.id) ?? 0,
    }));

  return {
    ...catalog,
    providers,
    data,
    paging: {
      ...catalog.paging,
      count: data.length,
    },
  };
}

/**
 * Fetch catalog from Restormel and fall back to local presets if unavailable.
 * This gives existing hosts a one-function migration path without losing UX resilience.
 */
export async function fetchCanonicalCatalogWithFallback(
  options: FetchCanonicalCatalogOptions & {
    fallback: () => CanonicalCatalogResponse | Promise<CanonicalCatalogResponse>;
  }
): Promise<{
  catalog: CanonicalCatalogResponse;
  source: "restormel" | "fallback";
  degradedReason?: string;
}> {
  try {
    const catalog = await fetchCanonicalCatalog(options);
    return { catalog, source: "restormel" };
  } catch (error) {
    const catalog = await options.fallback();
    const degradedReason = error instanceof Error ? error.message : "catalog_unavailable";
    return { catalog, source: "fallback", degradedReason };
  }
}

/**
 * Call POST .../projects/:id/resolve. Returns typed success or error; does not throw.
 */
export async function resolve(options: ResolveOptions): Promise<ResolveResult> {
  const base = getBaseUrl(options.baseUrl);
  const url = `${base}/keys/dashboard/api/projects/${encodeURIComponent(options.projectId)}/resolve`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${options.auth.token}`,
    ...options.headers,
  };
  const body = JSON.stringify({
    environmentId: options.environmentId,
    ...(options.routeId != null ? { routeId: options.routeId } : {}),
    ...(options.stage != null ? { stage: options.stage } : {}),
    ...(options.workload != null ? { workload: options.workload } : {}),
    ...(options.attemptNumber != null ? { attemptNumber: options.attemptNumber } : {}),
    ...(options.failureKind != null ? { failureKind: options.failureKind } : {}),
    ...(options.previousFailure != null ? { previousFailure: options.previousFailure } : {}),
    ...(options.estimatedInputTokens != null ? { estimatedInputTokens: options.estimatedInputTokens } : {}),
    ...(options.estimatedInputChars != null ? { estimatedInputChars: options.estimatedInputChars } : {}),
    ...(options.complexity != null ? { complexity: options.complexity } : {}),
    ...(options.latencyPreference != null ? { latencyPreference: options.latencyPreference } : {}),
    ...(options.maxCostUsd != null ? { maxCostUsd: options.maxCostUsd } : {}),
  });

  const res = await fetch(url, { method: "POST", headers, body });
  const json = await res.json().catch(() => ({} as Record<string, unknown>));

  if (res.ok) {
    const data = json.data as ResolveSuccess["data"] | undefined;
    if (data) {
      return { ok: true, data };
    }
    return {
      ok: false,
      status: res.status,
      error: "unknown",
      body: json as ResolveErrorBody,
    };
  }

  const errBody = json as ResolveErrorBody;
  const error = typeof errBody.error === "string" ? errBody.error : "unknown";
  return {
    ok: false,
    status: res.status,
    error,
    message: errBody.message,
    violations: Array.isArray(errBody.violations) ? errBody.violations : undefined,
    body: errBody,
  } as ResolveError;
}

/**
 * Call POST .../policies/evaluate. Returns allowed + violations. Throws on HTTP error.
 */
export async function evaluatePolicies(options: EvaluateOptions): Promise<EvaluateResult> {
  const base = getBaseUrl(options.baseUrl);
  const url = `${base}/keys/dashboard/api/policies/evaluate`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${options.auth.token}`,
    ...options.headers,
  };
  const body = JSON.stringify({
    projectId: options.projectId,
    ...(options.environmentId != null ? { environmentId: options.environmentId } : {}),
    ...(options.routeId != null ? { routeId: options.routeId } : {}),
    ...(options.modelId != null ? { modelId: options.modelId } : {}),
    ...(options.providerType != null ? { providerType: options.providerType } : {}),
    ...(options.modelLifecycleState != null ? { modelLifecycleState: options.modelLifecycleState } : {}),
  });

  const res = await fetch(url, { method: "POST", headers, body });
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    data?: { allowed?: boolean; violations?: PolicyViolation[] };
    error?: string;
  };

  if (!res.ok) {
    const err: RestormelApiError = new Error(json.error ?? `evaluate HTTP ${res.status}`) as RestormelApiError;
    err.status = res.status;
    err.error = typeof json.error === "string" ? json.error : "unknown";
    err.body = json;
    throw err;
  }

  const data = json.data;
  return {
    allowed: data?.allowed ?? true,
    violations: Array.isArray(data?.violations) ? data.violations : [],
  };
}

/** Type guard: result is resolve error with error code policy_blocked. */
export function isPolicyBlocked(result: ResolveResult): result is ResolveError {
  return !result.ok && result.error === "policy_blocked";
}

/** Type guard: result is resolve error with error code no_route. */
export function isNoRoute(result: ResolveResult): result is ResolveError {
  return !result.ok && result.error === "no_route";
}

/** Type guard: result is resolve error with error code usage_limit_reached. */
export function isUsageLimitReached(result: ResolveResult): result is ResolveError {
  return !result.ok && result.error === "usage_limit_reached";
}

/** Check if an arbitrary error has policy_blocked shape (e.g. from catch). */
export function isPolicyBlockedError(err: unknown): err is ResolveError {
  return (
    typeof err === "object" &&
    err !== null &&
    "ok" in err &&
    (err as ResolveError).ok === false &&
    (err as ResolveError).error === "policy_blocked"
  );
}

/** Candidate for policy check (providerType + modelId). */
export interface AllowedModelsCandidate {
  providerType: string;
  modelId: string;
}

/** Options for filterAllowedModels. */
export interface FilterAllowedModelsOptions {
  baseUrl?: string;
  projectId: string;
  environmentId?: string;
  routeId?: string;
  auth: { type: "bearer"; token: string };
  headers?: HeadersInit;
  /** Candidates to check; returned list is the subset that policy allows. */
  candidates: AllowedModelsCandidate[];
}

/**
 * Batch policy check: evaluate which of the given (providerType, modelId) pairs are allowed.
 * Calls evaluatePolicies in parallel for each candidate. Use this instead of building a
 * custom allowed-models proxy that checks one model at a time.
 * Server-side only; pass Gateway Key via auth.
 */
export async function filterAllowedModels(
  options: FilterAllowedModelsOptions
): Promise<AllowedModelsCandidate[]> {
  const detailed = await filterModelsByPolicy(options);
  return detailed.filter((e) => e.status === "allowed").map((e) => ({
    providerType: e.providerType,
    modelId: e.modelId,
  }));
}

/**
 * Why a candidate is not selectable after policy evaluation.
 * - `restormel_degraded`: Restormel unreachable or server-side failure (retry may help).
 * - `unknown_or_unavailable`: Policy check failed in an ambiguous or client-error way (4xx, etc.).
 */
export type FilteredModelStatus =
  | "allowed"
  | "blocked_by_policy"
  | "unknown_or_unavailable"
  | "restormel_degraded";

export interface FilteredModelEntry {
  providerType: string;
  modelId: string;
  status: FilteredModelStatus;
  violations?: PolicyViolation[];
  httpStatus?: number;
  message?: string;
}

/**
 * Same as filterAllowedModels but returns per-model status for UX
 * (allowed vs policy-blocked vs Restormel down).
 */
export async function filterModelsByPolicy(
  options: FilterAllowedModelsOptions
): Promise<FilteredModelEntry[]> {
  const { candidates, ...evalOpts } = options;
  if (candidates.length === 0) return [];

  const results = await Promise.all(
    candidates.map(async (c) => {
      try {
        const result = await evaluatePolicies({
          ...evalOpts,
          modelId: c.modelId,
          providerType: c.providerType,
        });
        if (result.allowed) {
          return {
            providerType: c.providerType,
            modelId: c.modelId,
            status: "allowed" as const,
          };
        }
        return {
          providerType: c.providerType,
          modelId: c.modelId,
          status: "blocked_by_policy" as const,
          violations: result.violations,
          message: "Blocked by policy",
        };
      } catch (e: unknown) {
        const err = e as Partial<RestormelApiError> & { status?: number };
        const statusCode = typeof err.status === "number" ? err.status : undefined;
        const msg = typeof err.message === "string" ? err.message : "Policy evaluation failed";
        const isNetwork =
          !statusCode ||
          statusCode >= 500 ||
          msg.toLowerCase().includes("fetch");
        const status: FilteredModelStatus = isNetwork
          ? "restormel_degraded"
          : "unknown_or_unavailable";
        return {
          providerType: c.providerType,
          modelId: c.modelId,
          status,
          httpStatus: statusCode,
          message: msg,
        };
      }
    })
  );

  return results;
}

/** Build candidates from provider definitions (uses provider `id` as policy providerType). */
export function candidatesFromProviderDefinitions(
  providers: Array<{ id: string; models: string[] }>
): AllowedModelsCandidate[] {
  const out: AllowedModelsCandidate[] = [];
  for (const p of providers) {
    for (const modelId of p.models ?? []) {
      out.push({ providerType: p.id, modelId });
    }
  }
  return out;
}

/**
 * Map policy filter results to ModelSelector availability keys (`providerId:modelId`).
 */
/** One model row for ModelSelector with policy/status metadata (host-rendered reasons). */
export interface GroupedModelForSelector {
  modelId: string;
  status: FilteredModelStatus;
  message?: string;
  violations?: PolicyViolation[];
}

/** Provider bucket for ModelSelector: stable order from `sourceProviders`. */
export interface GroupedProviderForSelector {
  id: string;
  name: string;
  models: GroupedModelForSelector[];
}

/**
 * Merge server-side policy results with the host’s provider list for ModelSelector.
 * Models with no matching entry get `unknown_or_unavailable`.
 */
export function groupedModelsForModelSelector(
  sourceProviders: Array<{ id: string; name: string; models: string[] }>,
  entries: FilteredModelEntry[],
  /** Map policy providerType → UI provider id if they differ (default: identity). */
  providerTypeToId: (providerType: string) => string = (t) => t
): GroupedProviderForSelector[] {
  const byPair = new Map<string, FilteredModelEntry>();
  for (const e of entries) {
    byPair.set(`${providerTypeToId(e.providerType)}\0${e.modelId}`, e);
  }
  const out: GroupedProviderForSelector[] = [];
  for (const p of sourceProviders) {
    const models: GroupedModelForSelector[] = [];
    for (const modelId of p.models ?? []) {
      const e = byPair.get(`${p.id}\0${modelId}`);
      if (e) {
        models.push({
          modelId,
          status: e.status,
          message: e.message,
          violations: e.violations,
        });
      } else {
        models.push({
          modelId,
          status: "unknown_or_unavailable",
          message: "No policy result for this model",
        });
      }
    }
    if (models.length > 0) {
      out.push({ id: p.id, name: p.name, models });
    }
  }
  return out;
}

export interface PolicyAvailabilityMapEntry {
  available: boolean;
  reason?: string;
  enforcement?: "hard" | "soft";
}

export function policyAvailabilityMapFromEntries(
  entries: FilteredModelEntry[],
  /** Map policy providerType → UI provider id if they differ (default: identity). */
  providerTypeToId: (providerType: string) => string = (t) => t
): Record<string, PolicyAvailabilityMapEntry> {
  const map: Record<string, PolicyAvailabilityMapEntry> = {};
  for (const e of entries) {
    const id = providerTypeToId(e.providerType);
    const key = `${id}:${e.modelId}`;
    if (e.status === "allowed") {
      map[key] = { available: true };
    } else if (e.status === "blocked_by_policy") {
      const v = e.violations?.[0]?.message ?? e.message ?? "Blocked by policy";
      map[key] = { available: false, reason: `Policy: ${v}`, enforcement: "hard" };
    } else if (e.status === "restormel_degraded") {
      map[key] = {
        available: false,
        reason: e.message ?? "Restormel temporarily unavailable",
        enforcement: "soft",
      };
    } else {
      map[key] = {
        available: false,
        reason: e.message ?? "Model unavailable or policy check failed",
        enforcement: "soft",
      };
    }
  }
  return map;
}

/**
 * Full ProviderDefinition list for ModelSelector: only models policy marks `allowed`.
 */
export function filterProviderDefinitionsByAllowedPolicy(
  sourceProviders: ProviderDefinition[],
  entries: FilteredModelEntry[]
): ProviderDefinition[] {
  const allowed = new Set(
    entries
      .filter((e) => e.status === "allowed")
      .map((e) => `${e.providerType}\0${e.modelId}`)
  );
  return sourceProviders
    .map((p) => ({
      ...p,
      models: p.models.filter((m) => allowed.has(`${p.id}\0${m}`)),
    }))
    .filter((p) => p.models.length > 0);
}
