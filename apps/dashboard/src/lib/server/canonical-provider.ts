/**
 * Single canonical provider vocabulary for Dashboard API JSON (resolve, simulate, route steps).
 * Matches executor expectations (e.g. `vertex` for Google/Vertex AI). Persisted step rows may use legacy aliases.
 */

export {
  ROUTE_STEP_ALLOWED_STORAGE_PROVIDERS,
  type RouteStepAllowedStorageProviderId,
} from "$lib/route-step-allowed-providers";

/** Values emitted by resolve/simulate/list responses after normalization. */
export const CANONICAL_PROVIDER_TYPES = [
  "openai",
  "anthropic",
  "vertex",
  "openrouter",
  "vercel",
  "portkey",
  "voyage",
  "mistral",
  "deepseek",
  "together",
  "cohere",
  "groq",
  "xai",
  "aizolo",
] as const;

export type CanonicalProviderType = (typeof CANONICAL_PROVIDER_TYPES)[number];

const CANONICAL_SET = new Set<string>(CANONICAL_PROVIDER_TYPES);

/** Normalize free-text / legacy labels to slug form before alias map. */
function slugProviderInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

/**
 * Map stored or inbound provider string to canonical API `providerType`.
 * Returns null if unknown or empty (caller treats as not executable).
 */
export function normalizeProviderToCanonicalApi(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const k = slugProviderInput(String(raw));
  if (k === "google" || k === "vertex" || k === "google_cloud" || k === "vertex_ai" || k === "generative_ai") {
    return "vertex";
  }
  if (k === "xai" || k === "grok" || k === "x.ai" || k === "x_ai") {
    return "xai";
  }
  if (CANONICAL_SET.has(k)) return k;
  return null;
}

/**
 * Provider id for policy evaluation and @restormel/keys cost (`defaultProviders` uses `google` not `vertex`).
 */
export function canonicalApiToPolicyProvider(canonical: string | null | undefined): string | undefined {
  if (!canonical) return undefined;
  if (canonical === "vertex") return "google";
  return canonical;
}

/** Accept legacy aliases on step create/patch; return value safe to persist (matches provider enum in UI). */
export function normalizeProviderForStorage(raw: string | null | undefined): string | null {
  const canonical = normalizeProviderToCanonicalApi(raw);
  if (!canonical) return typeof raw === "string" && raw.trim() ? slugProviderInput(raw) : null;
  if (canonical === "vertex") return "google";
  return canonical;
}

export function isExecutableProviderModelPair(
  providerPreference: string | null | undefined,
  modelId: string | null | undefined
): { ok: true; canonicalProvider: CanonicalProviderType; modelId: string } | { ok: false; reason: string } {
  const canonical = normalizeProviderToCanonicalApi(providerPreference);
  const mid = typeof modelId === "string" ? modelId.trim() : "";
  if (!canonical) {
    return { ok: false, reason: "missing_or_unknown_provider" };
  }
  if (!mid) {
    return { ok: false, reason: "missing_model_id" };
  }
  return { ok: true, canonicalProvider: canonical as CanonicalProviderType, modelId: mid };
}
