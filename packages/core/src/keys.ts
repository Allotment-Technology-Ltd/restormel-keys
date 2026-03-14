import type { KeysConfig } from "./types.js";
import type { ProviderDefinition } from "./providers/types.js";
import { createRouter } from "./router.js";
import { estimateCost as estimateCostFn, trackCost as trackCostFn, type UsageTracker } from "./cost.js";
import { createEntitlements } from "./entitlements.js";
import { createWallet, type WalletStore } from "./wallet.js";
import type { Router, ResolveResult } from "./router.js";
import type { Entitlements } from "./entitlements.js";
import type { Wallet } from "./wallet.js";
import type { UsageRecord } from "./types.js";

export interface CreateKeysOptions {
  providers: ProviderDefinition[];
  getByokKeys?: () => KeysConfig["keys"] | Promise<KeysConfig["keys"]>;
  getPlatformKey?: (provider: string) => string | null | Promise<string | null>;
  usageTracker?: UsageTracker;
  walletStore?: WalletStore;
}

export interface KeysInstance {
  config: KeysConfig;
  router: Router;
  entitlements: Entitlements;
  wallet: Wallet;
  /** Resolve which key to use (BYOK → fallback → platform). */
  resolve(providerId?: string, modelId?: string): Promise<ResolveResult>;
  /** Estimate cost for a model across providers. */
  estimateCost(modelId: string): ReturnType<typeof estimateCostFn> | null;
  /** Track actual usage for billing. */
  trackCost(userId: string, keyId: string, modelId: string, usage: UsageRecord): void | Promise<void>;
  /** All model ids from providers (for getAvailableModels). */
  getAllModelIds(): string[];
}

/**
 * Create a functional Keys instance with router, cost, entitlements, and wallet.
 */
export function createKeys(config: KeysConfig, options?: CreateKeysOptions): KeysInstance {
  const providers = options?.providers ?? [];
  const routerOptions = {
    getByokKeys: options?.getByokKeys
      ? async () => {
          const k = await Promise.resolve(options.getByokKeys!());
          return Array.isArray(k) ? k : [];
        }
      : undefined,
    getPlatformKey: options?.getPlatformKey,
  };
  const router = createRouter(config, providers, routerOptions);
  const entitlements = createEntitlements(config);
  const wallet = createWallet(options?.walletStore);
  const usageTracker = options?.usageTracker;

  function getAllModelIds(): string[] {
    const set = new Set<string>();
    for (const p of providers) {
      for (const m of p.models) set.add(m);
    }
    return [...set];
  }

  return {
    config,
    router,
    entitlements,
    wallet,
    resolve(providerId?: string, modelId?: string) {
      return router.resolve(providerId, modelId);
    },
    estimateCost(modelId: string) {
      return estimateCostFn(modelId, providers);
    },
    trackCost(userId: string, keyId: string, modelId: string, usage: UsageRecord) {
      return trackCostFn(userId, keyId, modelId, usage, usageTracker);
    },
    getAllModelIds,
  };
}
