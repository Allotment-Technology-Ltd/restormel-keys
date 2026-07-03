/**
 * Canonical catalog allowlist: only (providerId, providerModelId) pairs that appear
 * in `@restormel/keys` defaultProviders are exposed via GET /keys/dashboard/api/catalog
 * by default. Keeps downstream UIs aligned with the library and drops stale DB rows.
 */
import { defaultProviders } from "./defaults.js";

export function buildDefaultProviderModelAllowlist(): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const p of defaultProviders) {
    m.set(p.id, new Set(p.models));
  }
  return m;
}

/** True if this variant is a current default model for the provider in @restormel/keys. */
export function isProviderModelInDefaultAllowlist(
  providerId: string,
  providerModelId: string,
  allowlist: Map<string, Set<string>> = buildDefaultProviderModelAllowlist()
): boolean {
  const set = allowlist.get(providerId);
  return set?.has(providerModelId) ?? false;
}
