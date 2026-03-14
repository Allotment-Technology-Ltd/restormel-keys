/**
 * Routing engine: BYOK key → fallback chain → platform key → no_key_available.
 */
import type { KeysConfig, KeyConfig, ResolvedRoute, ProviderId } from "./types.js";
import type { ProviderDefinition } from "./providers/types.js";

export const NO_KEY_AVAILABLE = "no_key_available";

export interface ResolveResult extends ResolvedRoute {
  keyId?: string;
  source: "byok" | "platform";
}

export interface RouterOptions {
  /** Current BYOK keys (e.g. from storage). */
  getByokKeys?: () => KeyConfig[] | Promise<KeyConfig[]>;
  /** Platform key for a provider (optional). */
  getPlatformKey?: (provider: ProviderId) => string | null | Promise<string | null>;
}

function keyIdFromKeyConfig(k: KeyConfig): string | undefined {
  return (k as KeyConfig & { id?: string }).id ?? undefined;
}

export interface Router {
  resolve(providerId?: ProviderId, modelId?: string): Promise<ResolveResult>;
  /** Resolve using a specific set of BYOK keys (e.g. for per-request user keys). */
  resolveWithKeys(
    providerId: ProviderId | undefined,
    modelId: string | undefined,
    byokKeys: KeyConfig[]
  ): Promise<ResolveResult>;
}

export function createRouter(
  config: KeysConfig,
  providers: ProviderDefinition[],
  options: RouterOptions = {}
): Router {
  const providerIds = new Set(providers.map((p) => p.id));
  const defaultProvider = config.routing?.defaultProvider as ProviderId | undefined;
  const fallbackChain = (config.routing?.rules as ProviderId[] | undefined) ?? (defaultProvider ? [defaultProvider] : []);
  const platformKeys = (config.routing as { platformKeys?: Record<string, string> })?.platformKeys ?? {};
  const configKeys = config.keys ?? [];

  async function getByokKeys(): Promise<KeyConfig[]> {
    const fn = options.getByokKeys;
    if (fn) {
      const keys = await fn();
      return Array.isArray(keys) ? keys : [];
    }
    return configKeys;
  }

  async function getPlatformKey(provider: ProviderId): Promise<string | null> {
    const fn = options.getPlatformKey;
    if (fn) {
      return await fn(provider);
    }
    return platformKeys[provider] ?? null;
  }

  async function doResolve(
    providerId: ProviderId | undefined,
    modelId: string | undefined,
    byokKeysOverride?: KeyConfig[]
  ): Promise<ResolveResult> {
    const targetProvider = providerId ?? defaultProvider;
    const toTry = targetProvider ? [targetProvider, ...fallbackChain.filter((p) => p !== targetProvider)] : [...fallbackChain];
    const byokKeys = byokKeysOverride ?? (await getByokKeys());

    for (const provider of toTry) {
      if (!providerIds.has(provider)) continue;

      const byok = byokKeys.find((k) => k.provider === provider);
      if (byok) {
        return {
          provider,
          model: modelId,
          keyId: keyIdFromKeyConfig(byok),
          source: "byok",
        };
      }

      const platformKey = await getPlatformKey(provider);
      if (platformKey) {
        return {
          provider,
          model: modelId,
          source: "platform",
        };
      }
    }

    throw new Error(NO_KEY_AVAILABLE);
  }

  return {
    resolve(providerId?: ProviderId, modelId?: string) {
      return doResolve(providerId, modelId);
    },
    resolveWithKeys(providerId: ProviderId | undefined, modelId: string | undefined, byokKeys: KeyConfig[]) {
      return doResolve(providerId, modelId, byokKeys);
    },
  };
}
