/**
 * Tests: routing resolution, cost accuracy, entitlement enforcement, wallet operations, createKeys.
 */
import { describe, it, expect } from "vitest";
import {
  createKeys,
  createRouter,
  NO_KEY_AVAILABLE,
  estimateCost,
  createEntitlements,
  createWallet,
  openaiProvider,
  anthropicProvider,
  googleProvider,
} from "./index.js";
import type { KeysConfig } from "./types.js";

const providers = [openaiProvider, anthropicProvider, googleProvider];

describe("router – resolution", () => {
  it("resolves to BYOK key when user has key for provider", async () => {
    const config: KeysConfig = {
      keys: [{ provider: "openai", id: "key-1" }],
      routing: { defaultProvider: "openai" },
    };
    const router = createRouter(config, providers);
    const result = await router.resolve("openai");
    expect(result.source).toBe("byok");
    expect(result.provider).toBe("openai");
    expect(result.keyId).toBe("key-1");
  });

  it("resolves to platform key when no BYOK", async () => {
    const config: KeysConfig = {
      keys: [],
      routing: { defaultProvider: "openai", platformKeys: { openai: "platform-key" } },
    };
    const router = createRouter(config, providers);
    const result = await router.resolve("openai");
    expect(result.source).toBe("platform");
    expect(result.provider).toBe("openai");
  });

  it("falls back along chain when first provider has no key", async () => {
    const config: KeysConfig = {
      keys: [{ provider: "anthropic", id: "byok-anthropic" }],
      routing: { defaultProvider: "openai", rules: ["openai", "anthropic"] },
    };
    const router = createRouter(config, providers);
    const result = await router.resolve("openai");
    expect(result.source).toBe("byok");
    expect(result.provider).toBe("anthropic");
  });

  it("throws NO_KEY_AVAILABLE when no key in chain", async () => {
    const config: KeysConfig = {
      keys: [],
      routing: { defaultProvider: "openai" },
    };
    const router = createRouter(config, providers);
    await expect(router.resolve("openai")).rejects.toThrow(NO_KEY_AVAILABLE);
  });

  it("uses getByokKeys when provided", async () => {
    const config: KeysConfig = { routing: { defaultProvider: "openai" } };
    const router = createRouter(config, providers, {
      getByokKeys: () => Promise.resolve([{ provider: "openai", id: "dynamic" }]),
    });
    const result = await router.resolve("openai");
    expect(result.keyId).toBe("dynamic");
    expect(result.source).toBe("byok");
  });
});

describe("cost – accuracy", () => {
  it("estimateCost returns correct value for known model", () => {
    const est = estimateCost("gpt-4o", providers);
    expect(est).not.toBeNull();
    expect(est!.modelId).toBe("gpt-4o");
    expect(est!.inputPerMillion).toBe(2.5);
    expect(est!.outputPerMillion).toBe(10);
  });

  it("estimateCost returns null for unknown model", () => {
    expect(estimateCost("unknown-model", providers)).toBeNull();
  });

  it("estimateCost finds model in second provider", () => {
    const est = estimateCost("claude-sonnet-4", providers);
    expect(est?.providerId).toBe("anthropic");
  });
});

describe("entitlements – enforcement and glob", () => {
  it("check allows when model matches pattern", () => {
    const config: KeysConfig = {
      plans: [
        {
          id: "pro",
          entitlements: { allowedModels: ["gpt-4o*", "claude-*"] },
        },
      ],
    };
    const ent = createEntitlements(config);
    expect(ent.check("gpt-4o").allowed).toBe(true);
    expect(ent.check("gpt-4o-mini").allowed).toBe(true);
    expect(ent.check("claude-sonnet-4").allowed).toBe(true);
  });

  it("check denies when no match", () => {
    const config: KeysConfig = {
      plans: [{ id: "free", entitlements: { allowedModels: ["gpt-4o-mini"] } }],
    };
    const ent = createEntitlements(config);
    expect(ent.check("gpt-4o").allowed).toBe(false);
  });

  it("getAvailableModels filters by glob", () => {
    const config: KeysConfig = {
      plans: [{ id: "p", entitlements: { allowedModels: ["gpt-4o*"] } }],
    };
    const ent = createEntitlements(config);
    const candidates = ["gpt-4o", "gpt-4o-mini", "o1", "claude-3"];
    expect(ent.getAvailableModels(candidates)).toEqual(["gpt-4o", "gpt-4o-mini"]);
  });
});

describe("wallet – operations", () => {
  it("getBalance returns 0 initially", async () => {
    const wallet = createWallet();
    expect(await wallet.getBalance("u1")).toBe(0);
  });

  it("credit increases balance", async () => {
    const wallet = createWallet();
    await wallet.credit("u1", 100);
    expect(await wallet.getBalance("u1")).toBe(100);
  });

  it("debit decreases balance", async () => {
    const wallet = createWallet();
    await wallet.credit("u1", 100);
    await wallet.debit("u1", 30, "idem-1");
    expect(await wallet.getBalance("u1")).toBe(70);
  });

  it("debit is idempotent with same key", async () => {
    const wallet = createWallet();
    await wallet.credit("u1", 100);
    await wallet.debit("u1", 30, "idem-same");
    await wallet.debit("u1", 30, "idem-same");
    expect(await wallet.getBalance("u1")).toBe(70);
  });

  it("debit throws on insufficient balance", async () => {
    const wallet = createWallet();
    await wallet.credit("u1", 10);
    await expect(wallet.debit("u1", 20, "idem-2")).rejects.toThrow("insufficient_balance");
  });
});

describe("createKeys – functional instance", () => {
  it("returns instance with router, entitlements, wallet", () => {
    const config: KeysConfig = {
      keys: [{ provider: "openai", id: "k1" }],
      routing: { defaultProvider: "openai" },
      plans: [{ id: "p", entitlements: { allowedModels: ["gpt-4o*"] } }],
    };
    const keys = createKeys(config, { providers });
    expect(keys.router).toBeDefined();
    expect(keys.entitlements).toBeDefined();
    expect(keys.wallet).toBeDefined();
    expect(keys.resolve).toBeDefined();
    expect(keys.estimateCost).toBeDefined();
    expect(keys.trackCost).toBeDefined();
    expect(keys.getAllModelIds().length).toBeGreaterThan(0);
  });

  it("resolve works via instance", async () => {
    const config: KeysConfig = {
      keys: [{ provider: "openai", id: "k1" }],
      routing: { defaultProvider: "openai" },
    };
    const keys = createKeys(config, { providers });
    const result = await keys.resolve("openai");
    expect(result.provider).toBe("openai");
    expect(result.source).toBe("byok");
  });

  it("estimateCost and getAvailableModels work via instance", () => {
    const config: KeysConfig = {
      plans: [{ id: "p", entitlements: { allowedModels: ["*"] } }],
    };
    const keys = createKeys(config, { providers });
    const est = keys.estimateCost("gpt-4o-mini");
    expect(est?.inputPerMillion).toBe(0.15);
    const all = keys.getAllModelIds();
    const available = keys.entitlements.getAvailableModels(all);
    expect(available.length).toBe(all.length);
  });

  it("wallet getBalance and credit work via instance", async () => {
    const keys = createKeys({} as KeysConfig, { providers });
    expect(await keys.wallet.getBalance("u")).toBe(0);
    await keys.wallet.credit("u", 50);
    expect(await keys.wallet.getBalance("u")).toBe(50);
  });
});
