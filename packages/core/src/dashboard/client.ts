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
} from "./types.js";

const DEFAULT_BASE = "https://restormel.dev";

function getBaseUrl(baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/$/, "");
  if (typeof process !== "undefined" && process.env?.RESTORMEL_KEYS_BASE) {
    return process.env.RESTORMEL_KEYS_BASE.replace(/\/$/, "");
  }
  return DEFAULT_BASE;
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
