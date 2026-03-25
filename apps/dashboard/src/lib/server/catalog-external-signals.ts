/**
 * Credential-free signals for the public catalog: OpenRouter public model list + vendor status pages.
 * All fetches are unauthenticated; results are cached per runtime instance (short TTL).
 */

export const OPENROUTER_PUBLIC_MODELS_URL = "https://openrouter.ai/api/v1/models";

const OPENAI_STATUS_URL = "https://status.openai.com/api/v2/summary.json";
const ANTHROPIC_STATUS_URL = "https://status.anthropic.com/api/v2/summary.json";

const OPENROUTER_CACHE_TTL_MS = 15 * 60 * 1000;
const STATUS_CACHE_TTL_MS = 5 * 60 * 1000;
const OPENROUTER_ENDPOINTS_CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 25_000;

/** SLO: downstream UIs may treat data older than this as stale (matches cache TTL). */
export const OPENROUTER_MODELS_MAX_AGE_MS = OPENROUTER_CACHE_TTL_MS;
export const PROVIDER_STATUS_MAX_AGE_MS = STATUS_CACHE_TTL_MS;
export const OPENROUTER_ENDPOINT_HEALTH_MAX_AGE_MS = OPENROUTER_ENDPOINTS_CACHE_TTL_MS;

export type SignalFreshness = {
  isFresh: boolean;
  /** Age of the sample at response time (ms). */
  ageMs: number;
  maxAgeMs: number;
};

export type ExternalSignalsFreshness = {
  slo: {
    openRouterModelsMaxAgeMs: number;
    providerStatusMaxAgeMs: number;
    openRouterEndpointHealthMaxAgeMs: number;
  };
  openRouterModels: SignalFreshness;
  providerStatus: {
    openai: SignalFreshness;
    anthropic: SignalFreshness;
  };
  /** Aggregate over per-model OpenRouter endpoint health rows in this response. */
  openRouterEndpointHealth: {
    isFresh: boolean;
    /** Largest age among included per-model samples (worst case). */
    maxAgeMs: number;
    maxAgeMsThreshold: number;
    staleModelIds?: string[];
    modelCount: number;
  };
  /** True when every tracked signal is within its SLO age. */
  allFresh: boolean;
};

type NumericQuantiles = {
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p99: number | null;
};

export type OpenRouterEndpointHealth = {
  providerModelId: string;
  fetchedAt: string;
  endpointCount: number;
  statuses: string[];
  uptimeLast30m: number | null;
  latencyLast30m: NumericQuantiles | null;
  throughputLast30m: NumericQuantiles | null;
  error?: string;
};

function ageMsFromIso(fetchedAt: string, nowMs: number): number {
  const t = Date.parse(fetchedAt);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - t);
}

export function freshnessGuard(fetchedAt: string, maxAgeMs: number, nowMs: number = Date.now()): SignalFreshness {
  const ageMs = ageMsFromIso(fetchedAt, nowMs);
  return {
    isFresh: ageMs <= maxAgeMs,
    ageMs,
    maxAgeMs,
  };
}

/**
 * Staleness guard for `externalSignals`: lets downstream apps degrade UI when samples exceed SLO age.
 */
export function buildExternalSignalsFreshness(args: {
  openRouterModelsFetchedAt: string;
  openaiFetchedAt: string;
  anthropicFetchedAt: string;
  endpointHealthByModel: Record<string, OpenRouterEndpointHealth>;
  nowMs?: number;
}): ExternalSignalsFreshness {
  const now = args.nowMs ?? Date.now();
  const slo = {
    openRouterModelsMaxAgeMs: OPENROUTER_MODELS_MAX_AGE_MS,
    providerStatusMaxAgeMs: PROVIDER_STATUS_MAX_AGE_MS,
    openRouterEndpointHealthMaxAgeMs: OPENROUTER_ENDPOINT_HEALTH_MAX_AGE_MS,
  };

  const openRouterModels = freshnessGuard(args.openRouterModelsFetchedAt, slo.openRouterModelsMaxAgeMs, now);
  const openai = freshnessGuard(args.openaiFetchedAt, slo.providerStatusMaxAgeMs, now);
  const anthropic = freshnessGuard(args.anthropicFetchedAt, slo.providerStatusMaxAgeMs, now);

  const entries = Object.values(args.endpointHealthByModel);
  const staleModelIds: string[] = [];
  let maxAge = 0;
  for (const e of entries) {
    const age = ageMsFromIso(e.fetchedAt, now);
    if (age > maxAge) maxAge = age;
    if (age > slo.openRouterEndpointHealthMaxAgeMs) staleModelIds.push(e.providerModelId);
  }
  staleModelIds.sort();

  const endpointFresh: ExternalSignalsFreshness["openRouterEndpointHealth"] = {
    isFresh: entries.length === 0 || staleModelIds.length === 0,
    maxAgeMs: entries.length === 0 ? 0 : maxAge,
    maxAgeMsThreshold: slo.openRouterEndpointHealthMaxAgeMs,
    ...(staleModelIds.length > 0 ? { staleModelIds } : {}),
    modelCount: entries.length,
  };

  const allFresh =
    openRouterModels.isFresh && openai.isFresh && anthropic.isFresh && endpointFresh.isFresh;

  return {
    slo,
    openRouterModels,
    providerStatus: { openai, anthropic },
    openRouterEndpointHealth: endpointFresh,
    allFresh,
  };
}

type OpenRouterSnapshot =
  | {
      ok: true;
      modelCount: number;
      ids: Set<string>;
      fetchedAt: string;
    }
  | {
      ok: false;
      modelCount: 0;
      ids: null;
      fetchedAt: string;
      error: string;
    };

let openRouterCache: { snapshot: OpenRouterSnapshot; storedAt: number } | null = null;

type StatuspageSummaryResult =
  | {
      ok: true;
      indicator: string | null;
      description: string | null;
      statusUrl: string;
      fetchedAt: string;
    }
  | {
      ok: false;
      indicator: null;
      description: null;
      statusUrl: string;
      fetchedAt: string;
      error: string;
    };

const statusCache = new Map<string, { entry: StatuspageSummaryResult; storedAt: number }>();
const openRouterEndpointsCache = new Map<string, { entry: OpenRouterEndpointHealth; storedAt: number }>();

async function fetchJsonWithTimeout(url: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as unknown;
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Public OpenRouter `GET /api/v1/models` (no Authorization). Used to drop allowlisted models
 * that no longer appear in OpenRouter's catalog.
 */
export async function getOpenRouterPublicSnapshot(): Promise<OpenRouterSnapshot> {
  const now = Date.now();
  if (openRouterCache && now - openRouterCache.storedAt < OPENROUTER_CACHE_TTL_MS) {
    return openRouterCache.snapshot;
  }

  const fetchedAt = new Date().toISOString();
  const result = await fetchJsonWithTimeout(OPENROUTER_PUBLIC_MODELS_URL);
  if (!result.ok) {
    const snap: OpenRouterSnapshot = {
      ok: false,
      modelCount: 0,
      ids: null,
      fetchedAt,
      error: result.error,
    };
    openRouterCache = { snapshot: snap, storedAt: now };
    return snap;
  }

  const data = result.data as { data?: unknown };
  const rows = Array.isArray(data.data) ? data.data : [];
  const ids = new Set<string>();
  for (const row of rows) {
    if (row && typeof row === "object" && "id" in row && typeof (row as { id: unknown }).id === "string") {
      ids.add((row as { id: string }).id);
    }
  }

  const snap: OpenRouterSnapshot = {
    ok: true,
    modelCount: ids.size,
    ids,
    fetchedAt,
  };
  openRouterCache = { snapshot: snap, storedAt: now };
  return snap;
}

async function getStatuspageSummary(statusUrl: string, apiUrl: string): Promise<StatuspageSummaryResult> {
  const now = Date.now();
  const cached = statusCache.get(apiUrl);
  if (cached && now - cached.storedAt < STATUS_CACHE_TTL_MS) {
    return cached.entry;
  }

  const fetchedAt = new Date().toISOString();
  const result = await fetchJsonWithTimeout(apiUrl);
  if (!result.ok) {
    const entry: StatuspageSummaryResult = {
      ok: false,
      indicator: null,
      description: null,
      statusUrl,
      fetchedAt,
      error: result.error,
    };
    statusCache.set(apiUrl, { entry, storedAt: now });
    return entry;
  }

  const data = result.data as {
    status?: { indicator?: string; description?: string };
  };
  const indicator = data.status?.indicator ?? null;
  const description = data.status?.description ?? null;
  const entry: StatuspageSummaryResult = {
    ok: true,
    indicator,
    description,
    statusUrl,
    fetchedAt,
  };
  statusCache.set(apiUrl, { entry, storedAt: now });
  return entry;
}

export type CatalogExternalSignalsPayload = {
  /** Present when merged in catalog GET (staleness SLO). */
  freshness?: ExternalSignalsFreshness;
  openRouter: {
    source: string;
    ok: boolean;
    modelCount: number;
    fetchedAt: string;
    endpointHealthByModel?: Record<string, OpenRouterEndpointHealth>;
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

export async function getCatalogExternalSignals(): Promise<CatalogExternalSignalsPayload> {
  const { payload } = await loadCatalogExternalContext();
  return payload;
}

export type CatalogExternalContext = {
  payload: CatalogExternalSignalsPayload;
  /** When non-null, OpenRouter variants must use a `providerModelId` in this set. */
  openRouterListedIds: Set<string> | null;
};

/**
 * Single entry for the catalog handler: one OpenRouter fetch + status pages (parallel), shared cache.
 */
export async function loadCatalogExternalContext(): Promise<CatalogExternalContext> {
  const [openRouterSnap, openai, anthropic] = await Promise.all([
    getOpenRouterPublicSnapshot(),
    getStatuspageSummary("https://status.openai.com/", OPENAI_STATUS_URL),
    getStatuspageSummary("https://status.anthropic.com/", ANTHROPIC_STATUS_URL),
  ]);

  const payload: CatalogExternalSignalsPayload = {
    openRouter: {
      source: OPENROUTER_PUBLIC_MODELS_URL,
      ok: openRouterSnap.ok,
      modelCount: openRouterSnap.modelCount,
      fetchedAt: openRouterSnap.fetchedAt,
      ...(!openRouterSnap.ok && "error" in openRouterSnap ? { error: openRouterSnap.error } : {}),
    },
    providerStatus: {
      openai: {
        statusUrl: openai.statusUrl,
        ok: openai.ok,
        indicator: openai.indicator,
        description: openai.description,
        fetchedAt: openai.fetchedAt,
        ...(!openai.ok && "error" in openai ? { error: openai.error } : {}),
      },
      anthropic: {
        statusUrl: anthropic.statusUrl,
        ok: anthropic.ok,
        indicator: anthropic.indicator,
        description: anthropic.description,
        fetchedAt: anthropic.fetchedAt,
        ...(!anthropic.ok && "error" in anthropic ? { error: anthropic.error } : {}),
      },
    },
  };

  const openRouterListedIds =
    openRouterSnap.ok && openRouterSnap.ids.size > 0 ? openRouterSnap.ids : null;

  return { payload, openRouterListedIds };
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asQuantiles(value: unknown): NumericQuantiles | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  return {
    p50: asNullableNumber(obj.p50),
    p75: asNullableNumber(obj.p75),
    p90: asNullableNumber(obj.p90),
    p99: asNullableNumber(obj.p99),
  };
}

function aggregateEndpointHealth(providerModelId: string, endpoints: unknown[]): OpenRouterEndpointHealth {
  const fetchedAt = new Date().toISOString();
  const rows = endpoints.filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object");
  if (rows.length === 0) {
    return {
      providerModelId,
      fetchedAt,
      endpointCount: 0,
      statuses: [],
      uptimeLast30m: null,
      latencyLast30m: null,
      throughputLast30m: null,
    };
  }

  const statuses = Array.from(
    new Set(rows.map((r) => (typeof r.status === "string" ? r.status : null)).filter((s): s is string => Boolean(s)))
  ).sort();

  const uptimes = rows
    .map((r) => asNullableNumber(r.uptime_last_30m))
    .filter((n): n is number => n != null);
  const uptimeLast30m =
    uptimes.length > 0 ? Number((uptimes.reduce((acc, n) => acc + n, 0) / uptimes.length).toFixed(2)) : null;

  const latencyCandidates = rows.map((r) => asQuantiles(r.latency_last_30m)).filter((q): q is NumericQuantiles => q != null);
  const throughputCandidates = rows
    .map((r) => asQuantiles(r.throughput_last_30m))
    .filter((q): q is NumericQuantiles => q != null);
  const pickBest = (items: NumericQuantiles[]): NumericQuantiles | null => {
    if (items.length === 0) return null;
    const max = (k: keyof NumericQuantiles) => {
      const nums = items.map((i) => i[k]).filter((n): n is number => n != null);
      return nums.length > 0 ? Math.max(...nums) : null;
    };
    return { p50: max("p50"), p75: max("p75"), p90: max("p90"), p99: max("p99") };
  };

  return {
    providerModelId,
    fetchedAt,
    endpointCount: rows.length,
    statuses,
    uptimeLast30m,
    latencyLast30m: pickBest(latencyCandidates),
    throughputLast30m: pickBest(throughputCandidates),
  };
}

async function fetchOpenRouterModelEndpoints(providerModelId: string): Promise<OpenRouterEndpointHealth> {
  const now = Date.now();
  const cached = openRouterEndpointsCache.get(providerModelId);
  if (cached && now - cached.storedAt < OPENROUTER_ENDPOINTS_CACHE_TTL_MS) {
    return cached.entry;
  }

  const slash = providerModelId.indexOf("/");
  if (slash <= 0 || slash === providerModelId.length - 1) {
    const entry: OpenRouterEndpointHealth = {
      providerModelId,
      fetchedAt: new Date().toISOString(),
      endpointCount: 0,
      statuses: [],
      uptimeLast30m: null,
      latencyLast30m: null,
      throughputLast30m: null,
      error: "invalid_openrouter_model_id",
    };
    openRouterEndpointsCache.set(providerModelId, { entry, storedAt: now });
    return entry;
  }

  const author = providerModelId.slice(0, slash);
  const slug = providerModelId.slice(slash + 1);
  const url = `https://openrouter.ai/api/v1/models/${encodeURIComponent(author)}/${encodeURIComponent(slug)}/endpoints`;
  const result = await fetchJsonWithTimeout(url);
  if (!result.ok) {
    const entry: OpenRouterEndpointHealth = {
      providerModelId,
      fetchedAt: new Date().toISOString(),
      endpointCount: 0,
      statuses: [],
      uptimeLast30m: null,
      latencyLast30m: null,
      throughputLast30m: null,
      error: result.error,
    };
    openRouterEndpointsCache.set(providerModelId, { entry, storedAt: now });
    return entry;
  }

  const data = result.data as { data?: { endpoints?: unknown[] } | unknown[] };
  const endpoints = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.data?.endpoints)
      ? data.data.endpoints
      : [];
  const entry = aggregateEndpointHealth(providerModelId, endpoints);
  openRouterEndpointsCache.set(providerModelId, { entry, storedAt: now });
  return entry;
}

export async function getOpenRouterEndpointHealthByModel(
  providerModelIds: string[]
): Promise<Record<string, OpenRouterEndpointHealth>> {
  const unique = Array.from(new Set(providerModelIds.map((s) => s.trim()).filter(Boolean))).slice(0, 50);
  if (unique.length === 0) return {};
  const settled = await Promise.all(unique.map((id) => fetchOpenRouterModelEndpoints(id)));
  const out: Record<string, OpenRouterEndpointHealth> = {};
  for (const entry of settled) out[entry.providerModelId] = entry;
  return out;
}
