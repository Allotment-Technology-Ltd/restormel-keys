const NO_KEY_AVAILABLE = "no_key_available";
function keyIdFromKeyConfig(k) {
  return k.id ?? void 0;
}
function createRouter(config, providers, options = {}) {
  const providerIds = new Set(providers.map((p) => p.id));
  const defaultProvider = config.routing?.defaultProvider;
  const fallbackChain = config.routing?.rules ?? (defaultProvider ? [defaultProvider] : []);
  const platformKeys = config.routing?.platformKeys ?? {};
  const configKeys = config.keys ?? [];
  async function getByokKeys() {
    const fn = options.getByokKeys;
    if (fn) {
      const keys = await fn();
      return Array.isArray(keys) ? keys : [];
    }
    return configKeys;
  }
  async function getPlatformKey(provider) {
    const fn = options.getPlatformKey;
    if (fn) {
      return await fn(provider);
    }
    return platformKeys[provider] ?? null;
  }
  async function doResolve(providerId, modelId, byokKeysOverride) {
    const targetProvider = providerId ?? defaultProvider;
    const toTry = targetProvider ? [targetProvider, ...fallbackChain.filter((p) => p !== targetProvider)] : [...fallbackChain];
    const byokKeys = byokKeysOverride ?? await getByokKeys();
    for (const provider of toTry) {
      if (!providerIds.has(provider))
        continue;
      const byok = byokKeys.find((k) => k.provider === provider);
      if (byok) {
        return {
          provider,
          model: modelId,
          keyId: keyIdFromKeyConfig(byok),
          source: "byok"
        };
      }
      const platformKey = await getPlatformKey(provider);
      if (platformKey) {
        return {
          provider,
          model: modelId,
          source: "platform"
        };
      }
    }
    throw new Error(NO_KEY_AVAILABLE);
  }
  return {
    resolve(providerId, modelId) {
      return doResolve(providerId, modelId);
    },
    resolveWithKeys(providerId, modelId, byokKeys) {
      return doResolve(providerId, modelId, byokKeys);
    }
  };
}
const defaultTracker = {
  track() {
  }
};
function estimateCost$2(modelId, providers) {
  for (const p of providers) {
    const est = p.estimateCost(modelId);
    if (est) {
      return {
        modelId: est.id,
        providerId: p.id,
        inputPerMillion: est.inputPerMillion,
        outputPerMillion: est.outputPerMillion,
        unit: est.unit
      };
    }
  }
  return null;
}
function trackCost(userId, keyId, modelId, usage, tracker = defaultTracker) {
  return tracker.track(userId, keyId, modelId, usage);
}
function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}
function getModelPatterns(config) {
  const plans = config.plans ?? [];
  const patterns = [];
  for (const plan of plans) {
    const ent = plan.entitlements;
    const models = ent?.allowedModels ?? ent?.models ?? [];
    patterns.push(...models);
  }
  if (patterns.length === 0 && (config.models?.length ?? 0) > 0) {
    const defs = config.models ?? [];
    for (const m of defs) {
      if (typeof m === "object" && m && "id" in m)
        patterns.push(m.id);
    }
  }
  return patterns;
}
function createEntitlements(config) {
  const patterns = getModelPatterns(config);
  const regexes = patterns.map((p) => ({ pattern: p, re: globToRegExp(p) }));
  function matches(modelId) {
    return regexes.some(({ re }) => re.test(modelId));
  }
  return {
    check(modelId) {
      const allowed = matches(modelId);
      return { allowed, remaining: allowed ? void 0 : 0, limit: allowed ? void 0 : 0 };
    },
    getAvailableModels(candidateModelIds) {
      return candidateModelIds.filter((id) => matches(id));
    }
  };
}
const inMemoryStore = () => {
  const balances = /* @__PURE__ */ new Map();
  const debits = /* @__PURE__ */ new Set();
  return {
    getBalance(userId) {
      return balances.get(userId) ?? 0;
    },
    setBalance(userId, amount) {
      balances.set(userId, amount);
    },
    isDebitRecorded(userId, idempotencyKey) {
      return debits.has(`${userId}:${idempotencyKey}`);
    },
    recordDebit(userId, idempotencyKey) {
      debits.add(`${userId}:${idempotencyKey}`);
    }
  };
};
function createWallet(store = inMemoryStore()) {
  return {
    async getBalance(userId) {
      return await store.getBalance(userId);
    },
    async debit(userId, amount, idempotencyKey) {
      if (amount <= 0)
        return;
      const recorded = await store.isDebitRecorded(userId, idempotencyKey);
      if (recorded)
        return;
      const balance = await store.getBalance(userId);
      if (balance < amount)
        throw new Error("insufficient_balance");
      await store.setBalance(userId, balance - amount);
      await store.recordDebit(userId, idempotencyKey);
    },
    async credit(userId, amount) {
      if (amount <= 0)
        return;
      const balance = await store.getBalance(userId);
      await store.setBalance(userId, balance + amount);
    }
  };
}
function createKeys(config, options) {
  const providers = options?.providers ?? [];
  const routerOptions = {
    getByokKeys: options?.getByokKeys ? async () => {
      const k = await Promise.resolve(options.getByokKeys());
      return Array.isArray(k) ? k : [];
    } : void 0,
    getPlatformKey: options?.getPlatformKey
  };
  const router = createRouter(config, providers, routerOptions);
  const entitlements = createEntitlements(config);
  const wallet = createWallet(options?.walletStore);
  const usageTracker = options?.usageTracker;
  function getAllModelIds() {
    const set = /* @__PURE__ */ new Set();
    for (const p of providers) {
      for (const m of p.models)
        set.add(m);
    }
    return [...set];
  }
  return {
    config,
    router,
    entitlements,
    wallet,
    resolve(providerId, modelId) {
      return router.resolve(providerId, modelId);
    },
    estimateCost(modelId) {
      return estimateCost$2(modelId, providers);
    },
    trackCost(userId, keyId, modelId, usage) {
      return trackCost(userId, keyId, modelId, usage, usageTracker);
    },
    getAllModelIds
  };
}
const BASE_URL$1 = "https://api.openai.com";
const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4o-nano",
  "o1",
  "o1-mini",
  "gpt-4.1",
  "gpt-4.1-mini"
];
const OPENAI_PRICING = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o-nano": { input: 0.1, output: 0.4 },
  o1: { input: 15, output: 60 },
  "o1-mini": { input: 3, output: 12 },
  "gpt-4.1": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 }
};
async function validateKey$1(apiKey, fetchFn = fetch) {
  try {
    const res = await fetchFn(`${BASE_URL$1}/v1/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      const text = await res.text();
      return { valid: false, errors: [`${res.status}: ${text.slice(0, 200)}`] };
    }
    return { valid: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, errors: [msg] };
  }
}
function estimateCost$1(modelId) {
  const p = OPENAI_PRICING[modelId];
  if (!p)
    return null;
  return {
    id: modelId,
    inputPerMillion: p.input,
    outputPerMillion: p.output,
    unit: "USD"
  };
}
function createClient$1(apiKey) {
  return { provider: "openai", baseUrl: BASE_URL$1 };
}
const openaiProvider = {
  id: "openai",
  name: "OpenAI",
  models: [...OPENAI_MODELS],
  validateKey: validateKey$1,
  estimateCost: estimateCost$1,
  createClient: createClient$1
};
const BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_MODELS = [
  "claude-sonnet-4",
  "claude-haiku-4.5",
  "claude-opus-4"
];
const ANTHROPIC_PRICING = {
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-haiku-4.5": { input: 0.25, output: 1.25 },
  "claude-opus-4": { input: 15, output: 75 }
};
async function validateKey(apiKey, fetchFn = fetch) {
  try {
    const res = await fetchFn(`${BASE_URL}/v1/models`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });
    if (!res.ok) {
      const text = await res.text();
      return { valid: false, errors: [`${res.status}: ${text.slice(0, 200)}`] };
    }
    return { valid: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, errors: [msg] };
  }
}
function estimateCost(modelId) {
  const p = ANTHROPIC_PRICING[modelId];
  if (!p)
    return null;
  return {
    id: modelId,
    inputPerMillion: p.input,
    outputPerMillion: p.output,
    unit: "USD"
  };
}
function createClient(apiKey) {
  return { provider: "anthropic", baseUrl: BASE_URL };
}
const anthropicProvider = {
  id: "anthropic",
  name: "Anthropic",
  models: [...ANTHROPIC_MODELS],
  validateKey,
  estimateCost,
  createClient
};
export {
  NO_KEY_AVAILABLE as N,
  anthropicProvider as a,
  createKeys as c,
  openaiProvider as o
};
