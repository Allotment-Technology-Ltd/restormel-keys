/**
 * Verdict-cache discipline tests (restormel-verification-engineering §6 "how to verify").
 * Covers: exact-match key discrimination on EVERY field, order-invariant serialization,
 * purge-by-checker-version walk, and TTL/LRU GC leaving entries unreachable (not wrong).
 */
import { describe, it, expect } from "vitest";
import {
  verdictCacheKey,
  canonicalSerialize,
  InMemoryVerdictCache,
  type VerdictCacheKeyInputs,
  type CachedVerdict,
} from "../cascade/verdict-cache.js";

const BASE: VerdictCacheKeyInputs = {
  claimTextCanonical: "The term is three years.",
  sourceSpan: "the term of three years",
  sourceVersionHash: "abc123",
  checkerId: "granite-guardian-3.3-8b",
  checkerModelVersion: "3.3-8b",
  checkerConfigHash: "cfg-1",
  promptTemplateVersion: "1",
};

describe("verdictCacheKey — exact-match key discrimination", () => {
  it("produces a stable key for identical inputs", async () => {
    expect(await verdictCacheKey(BASE)).toBe(await verdictCacheKey({ ...BASE }));
  });

  it("changing ANY single field changes the key (every field is load-bearing)", async () => {
    const baseKey = await verdictCacheKey(BASE);
    const mutations: Partial<VerdictCacheKeyInputs>[] = [
      { claimTextCanonical: "The term is four years." },
      { sourceSpan: "a different span" },
      { sourceVersionHash: "def456" },
      { checkerId: "hhem-2.1-open" },
      { checkerModelVersion: "3.3-8b-v2" },
      { checkerConfigHash: "cfg-2" },
      { promptTemplateVersion: "2" },
    ];
    for (const m of mutations) {
      const key = await verdictCacheKey({ ...BASE, ...m });
      expect(key, `mutation ${JSON.stringify(m)} must miss`).not.toBe(baseKey);
    }
  });

  it("treats promptTemplateVersion 1 (number) and \"1\" (string) as the SAME key", async () => {
    const numeric = await verdictCacheKey({ ...BASE, promptTemplateVersion: 1 });
    const str = await verdictCacheKey({ ...BASE, promptTemplateVersion: "1" });
    expect(numeric).toBe(str);
  });
});

describe("canonicalSerialize — order invariance", () => {
  it("serializes semantically identical objects with reordered keys identically", () => {
    const a = canonicalSerialize({ b: 1, a: 2, nested: { y: 1, x: 2 } });
    const b = canonicalSerialize({ a: 2, b: 1, nested: { x: 2, y: 1 } });
    expect(a).toBe(b);
  });
});

describe("InMemoryVerdictCache — purge and GC", () => {
  const mkEntry = (checkerId: string, modelVersion: string): CachedVerdict => ({
    verdict: "supported",
    confidence: 0.9,
    checkerId,
    checkerModelVersion: modelVersion,
    storedAt: new Date().toISOString(),
  });

  it("purgeByChecker walks the checker-version index and removes only that checker's entries", async () => {
    const cache = new InMemoryVerdictCache();
    await cache.set("k1", mkEntry("granite", "3.3"));
    await cache.set("k2", mkEntry("granite", "3.3"));
    await cache.set("k3", mkEntry("hhem", "2.1"));
    expect(await cache.size()).toBe(3);

    const purged = await cache.purgeByChecker("granite", "3.3");
    expect(purged).toBe(2);
    expect(await cache.size()).toBe(1);
    expect(await cache.get("k3")).toBeDefined();
    expect(await cache.get("k1")).toBeUndefined();
  });

  it("TTL expiry makes an entry UNREACHABLE (returns undefined), never a wrong verdict", async () => {
    const cache = new InMemoryVerdictCache({ ttlMs: 5 });
    await cache.set("k", { ...mkEntry("granite", "3.3"), storedAt: new Date(Date.now() - 1000).toISOString() });
    expect(await cache.get("k")).toBeUndefined();
  });

  it("LRU eviction orphans the oldest entry when maxEntries is exceeded", async () => {
    const cache = new InMemoryVerdictCache({ maxEntries: 2 });
    await cache.set("old", { ...mkEntry("a", "1"), storedAt: new Date(Date.now() - 1000).toISOString() });
    await cache.set("mid", { ...mkEntry("b", "1"), storedAt: new Date(Date.now() - 500).toISOString() });
    await cache.set("new", { ...mkEntry("c", "1"), storedAt: new Date().toISOString() });
    expect(await cache.size()).toBe(2);
    expect(await cache.get("old")).toBeUndefined();
    expect(await cache.get("new")).toBeDefined();
  });
});
