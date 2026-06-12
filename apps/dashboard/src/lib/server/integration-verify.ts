/**
 * Provider integration verification: real authenticated probes for POST …/integrations/[id]/verify.
 *
 * Stage K2 (keys-core-journey-review-2026-06, K-P0-1): "Verify now" must contact the provider with
 * the decrypted hosted key and report an honest result. Each probe is the cheapest possible
 * authenticated read-only call for the family (a models/list endpoint or equivalent) — it spends
 * nothing beyond the request itself.
 *
 * Result taxonomy (never collapsed):
 *   - valid                → 2xx authenticated response; the ONLY path that may report "verified".
 *   - invalid_credentials  → provider explicitly rejected the credential (401/403).
 *   - network_error        → timeout / DNS / 5xx / provider rate limit; INDETERMINATE — the stored
 *                            verification status must NOT be overwritten (a good key is never
 *                            marked bad because of a blip).
 *   - unsupported_provider → no probe for this provider type; stays "pending" with honest copy.
 *   - reference_only       → vault-reference connection; Restormel holds no key to verify.
 *   - no_credential        → nothing stored at all.
 *
 * SECURITY: the API key is decrypted server-side by the caller and passed in; it is sent only as
 * the provider auth header. It is never logged and is scrubbed from any provider error text that
 * is surfaced to the UI.
 */

const ANTHROPIC_VERSION = "2023-06-01";

const DEFAULT_TIMEOUT_MS = 8_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 30_000;

/** Max sanitized provider-message length surfaced to the UI. */
const PROVIDER_MESSAGE_MAX = 200;

export type IntegrationVerifyResultKind =
  | "valid"
  | "invalid_credentials"
  | "network_error"
  | "unsupported_provider"
  | "reference_only"
  | "no_credential";

export type IntegrationVerifyOutcome = {
  /** Status to persist (and show) — "verified" only after a successful authenticated response. */
  verificationStatus: "verified" | "failed" | "pending" | "reference_only";
  /**
   * False for indeterminate outcomes (network_error): callers must keep the previously stored
   * verification status + lastVerifiedAt instead of overwriting them.
   */
  persistStatus: boolean;
  resultKind: IntegrationVerifyResultKind;
  /** Safe for UI and logs: never contains key material (provider text is scrubbed + truncated). */
  detail: string;
};

export type IntegrationVerifyCredential =
  | { mode: "encrypted"; apiKey: string }
  | { mode: "reference" }
  | { mode: "none" };

type ProbeSpec = {
  method: "GET";
  url: string;
  headers: (apiKey: string) => Record<string, string>;
};

function bearer(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

/**
 * Extra aliases the integrations UI persists that canonical-provider does not know about
 * (e.g. the "Vercel AI" connect card stores `vercel_ai_gateway`).
 */
const PROVIDER_ALIASES: Record<string, string> = {
  vercel_ai: "vercel",
  vercel_ai_gateway: "vercel",
  google: "vertex",
  google_cloud: "vertex",
  vertex_ai: "vertex",
};

function slugProvider(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

/**
 * Cheapest authenticated read-only endpoint per provider family.
 * Base URLs mirror runtime-openai-chat.ts / stage-route-generate.ts — keep in sync.
 *
 * Endpoint notes:
 *  - openrouter: /api/v1/models is PUBLIC (no auth) — a stub-grade trap. /api/v1/key returns the
 *    key's own metadata and requires auth.
 *  - vercel (AI Gateway): /v1/credits is the documented authenticated balance read.
 *  - voyage: has no models-list endpoint; GET /v1/files is its free authenticated list call.
 *  - vertex: Gemini API-key auth (x-goog-api-key) against the Generative Language models list.
 */
function probeSpecForCanonicalProvider(canonical: string): ProbeSpec | null {
  switch (canonical) {
    case "openai":
      return { method: "GET", url: "https://api.openai.com/v1/models", headers: bearer };
    case "anthropic":
      return {
        method: "GET",
        url: "https://api.anthropic.com/v1/models?limit=1",
        headers: (k) => ({ "x-api-key": k, "anthropic-version": ANTHROPIC_VERSION }),
      };
    case "vertex":
      return {
        method: "GET",
        url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
        headers: (k) => ({ "x-goog-api-key": k }),
      };
    case "mistral":
      return { method: "GET", url: "https://api.mistral.ai/v1/models", headers: bearer };
    case "together":
      return { method: "GET", url: "https://api.together.xyz/v1/models", headers: bearer };
    case "deepseek":
      return { method: "GET", url: "https://api.deepseek.com/v1/models", headers: bearer };
    case "groq":
      return { method: "GET", url: "https://api.groq.com/openai/v1/models", headers: bearer };
    case "cohere":
      return { method: "GET", url: "https://api.cohere.com/v1/models?page_size=1", headers: bearer };
    case "voyage":
      return { method: "GET", url: "https://api.voyageai.com/v1/files", headers: bearer };
    case "aizolo":
      return { method: "GET", url: "https://chat.aizolo.com/api/v1/models", headers: bearer };
    case "openrouter":
      return { method: "GET", url: "https://openrouter.ai/api/v1/key", headers: bearer };
    case "vercel":
      return { method: "GET", url: "https://ai-gateway.vercel.sh/v1/credits", headers: bearer };
    case "portkey":
      return {
        method: "GET",
        url: "https://api.portkey.ai/v1/configs",
        headers: (k) => ({ "x-portkey-api-key": k }),
      };
    default:
      return null;
  }
}

/** Exported for tests/UI hints: whether a provider type has a live probe. */
export function isVerifiableProviderType(providerType: string): boolean {
  const slug = slugProvider(providerType);
  const canonical = PROVIDER_ALIASES[slug] ?? slug;
  return probeSpecForCanonicalProvider(canonical) !== null;
}

export function integrationVerifyTimeoutMs(): number {
  const raw = Number(process.env.RESTORMEL_INTEGRATION_VERIFY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(raw)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(raw)));
}

/**
 * Scrub provider error text before it can reach the UI or a log line:
 * remove the key itself (and any Bearer tokens), collapse whitespace, truncate.
 */
export function sanitizeProviderMessage(raw: string, apiKey: string): string {
  let out = raw;
  if (apiKey.length >= 4) {
    out = out.split(apiKey).join("[redacted]");
  }
  out = out.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
  // Common provider key shapes (defence in depth if the provider echoes a partial key).
  out = out.replace(/\b(sk|rk|pk|key)[-_][A-Za-z0-9._-]{12,}\b/gi, "[redacted]");
  out = out.replace(/\s+/g, " ").trim();
  if (out.length > PROVIDER_MESSAGE_MAX) out = `${out.slice(0, PROVIDER_MESSAGE_MAX)}…`;
  return out;
}

function extractProviderErrorMessage(bodyText: string): string {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const err = obj.error;
      if (typeof err === "string") return err;
      if (err && typeof err === "object") {
        const msg = (err as Record<string, unknown>).message;
        if (typeof msg === "string") return msg;
      }
      if (typeof obj.message === "string") return obj.message;
      if (typeof obj.detail === "string") return obj.detail;
    }
  } catch {
    // Non-JSON body: fall through to raw text (still scrubbed + truncated by the caller).
  }
  return bodyText;
}

const UNSUPPORTED_DETAIL =
  "Credential is stored. Provider-specific automated probes are not enabled for this type yet.";

const REFERENCE_ONLY_DETAIL =
  "Reference-only connection — Restormel stores a vault label, not the key, so it cannot be verified or executed by Restormel. Add a hosted API key to enable verification.";

const NO_CREDENTIAL_DETAIL = "Add a provider credential before running verification.";

export async function runIntegrationVerificationProbe(input: {
  providerType: string;
  credential: IntegrationVerifyCredential;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<IntegrationVerifyOutcome> {
  if (input.credential.mode === "none") {
    return {
      verificationStatus: "failed",
      persistStatus: true,
      resultKind: "no_credential",
      detail: NO_CREDENTIAL_DETAIL,
    };
  }
  if (input.credential.mode === "reference") {
    return {
      verificationStatus: "reference_only",
      persistStatus: true,
      resultKind: "reference_only",
      detail: REFERENCE_ONLY_DETAIL,
    };
  }

  const slug = slugProvider(input.providerType);
  const canonical = PROVIDER_ALIASES[slug] ?? slug;
  const spec = probeSpecForCanonicalProvider(canonical);
  if (!spec) {
    return {
      verificationStatus: "pending",
      persistStatus: true,
      resultKind: "unsupported_provider",
      detail: UNSUPPORTED_DETAIL,
    };
  }

  const apiKey = input.credential.apiKey;
  const doFetch = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? integrationVerifyTimeoutMs();

  let res: Response;
  try {
    res = await doFetch(spec.url, {
      method: spec.method,
      headers: spec.headers(apiKey),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const timedOut = name === "TimeoutError" || name === "AbortError";
    return {
      verificationStatus: "pending",
      persistStatus: false,
      resultKind: "network_error",
      detail: timedOut
        ? `Could not reach ${canonical} within ${Math.round(timeoutMs / 1000)}s. The key was NOT marked invalid — try again shortly.`
        : `Network error reaching ${canonical}. The key was NOT marked invalid — try again shortly.`,
    };
  }

  if (res.ok) {
    return {
      verificationStatus: "verified",
      persistStatus: true,
      resultKind: "valid",
      detail: `Authenticated with ${canonical} (HTTP ${res.status}).`,
    };
  }

  if (res.status === 401 || res.status === 403) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      bodyText = "";
    }
    const providerMessage = sanitizeProviderMessage(extractProviderErrorMessage(bodyText), apiKey);
    return {
      verificationStatus: "failed",
      persistStatus: true,
      resultKind: "invalid_credentials",
      detail:
        `${canonical} rejected the credential (HTTP ${res.status}).` +
        (providerMessage ? ` Provider says: ${providerMessage}` : ""),
    };
  }

  if (res.status === 429) {
    return {
      verificationStatus: "pending",
      persistStatus: false,
      resultKind: "network_error",
      detail: `${canonical} rate-limited the probe (HTTP 429). The key was NOT marked invalid — try again shortly.`,
    };
  }

  // 404 / 5xx / anything else: the provider answered but the probe is indeterminate.
  return {
    verificationStatus: "pending",
    persistStatus: false,
    resultKind: "network_error",
    detail: `${canonical} returned HTTP ${res.status} for the verification probe. The key was NOT marked invalid — try again shortly.`,
  };
}

// ---------------------------------------------------------------------------
// Per-integration rate limit (fixed window, in-memory).
//
// Verification is user-initiated and spends the user's provider quota, so it is
// debounced per credential: default 5 probes per 60s window per integration id.
// Same pattern (and caveats: per Node process, single-instance deploy) as
// connect-v1/memory-rate-limit.ts. Auth runs BEFORE this at the route, so
// unauthenticated traffic can never consume a credential's budget.
// ---------------------------------------------------------------------------

const VERIFY_RATE_DEFAULT_LIMIT = 5;
const VERIFY_RATE_DEFAULT_WINDOW_MS = 60_000;
const VERIFY_RATE_PRUNE_THRESHOLD = 1024;

type VerifyWindowState = { windowStartMs: number; count: number };

const verifyWindows = new Map<string, VerifyWindowState>();

export type VerifyRateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

function verifyRateConfig(): { limit: number; windowMs: number } {
  const rawLimit = Number(process.env.RESTORMEL_INTEGRATION_VERIFY_RATE_LIMIT ?? VERIFY_RATE_DEFAULT_LIMIT);
  const rawWindow = Number(
    process.env.RESTORMEL_INTEGRATION_VERIFY_RATE_WINDOW_MS ?? VERIFY_RATE_DEFAULT_WINDOW_MS
  );
  return {
    limit: Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : VERIFY_RATE_DEFAULT_LIMIT,
    windowMs:
      Number.isFinite(rawWindow) && rawWindow >= 1000 ? Math.floor(rawWindow) : VERIFY_RATE_DEFAULT_WINDOW_MS,
  };
}

/** Check (and consume) one verify attempt for an integration id. Deterministic given `nowMs`. */
export function checkIntegrationVerifyRateLimit(integrationId: string, nowMs = Date.now()): VerifyRateLimitDecision {
  const { limit, windowMs } = verifyRateConfig();
  if (verifyWindows.size >= VERIFY_RATE_PRUNE_THRESHOLD) {
    for (const [key, state] of verifyWindows) {
      if (nowMs - state.windowStartMs >= windowMs) verifyWindows.delete(key);
    }
  }
  const state = verifyWindows.get(integrationId);
  if (!state || nowMs - state.windowStartMs >= windowMs) {
    verifyWindows.set(integrationId, { windowStartMs: nowMs, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }
  if (state.count >= limit) {
    const retryAfterMs = state.windowStartMs + windowMs - nowMs;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  state.count += 1;
  return { allowed: true, remaining: limit - state.count };
}

/** Test hook: the limiter is module-level state. */
export function resetIntegrationVerifyRateLimit(): void {
  verifyWindows.clear();
}
