/**
 * Security tests: format, determinism, masking, round-trip create→verify, timing-safe comparison.
 */
import { describe, it, expect } from "vitest";
import {
  createApiKey,
  hashApiKey,
  maskApiKey,
  timingSafeEqualHex,
  createKeyVerifier,
} from "./index.js";
import { createMemoryStorage } from "../storage/memory.js";

const HASH_SECRET = "test-secret-do-not-use-in-production";

describe("createApiKey – format", () => {
  it("generates key with default prefix sk-rk-", () => {
    const { rawKey, hash, id } = createApiKey(HASH_SECRET);
    expect(rawKey).toMatch(/^sk-rk-[a-f0-9]+$/);
    expect(rawKey.length).toBeGreaterThan(10);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(id).toMatch(/^rk_[a-f0-9]{12}$/);
  });

  it("generates key with custom prefix", () => {
    const { rawKey } = createApiKey(HASH_SECRET, "sk-my");
    expect(rawKey).toMatch(/^sk-my-[a-f0-9]+$/);
  });

  it("returns rawKey, hash, and id", () => {
    const out = createApiKey(HASH_SECRET, "sk-rk");
    expect(out).toHaveProperty("rawKey");
    expect(out).toHaveProperty("hash");
    expect(out).toHaveProperty("id");
    expect(typeof out.rawKey).toBe("string");
    expect(typeof out.hash).toBe("string");
    expect(typeof out.id).toBe("string");
  });
});

describe("hashApiKey – determinism", () => {
  it("same key and secret produce same hash", () => {
    const key = "sk-rk-abc123";
    expect(hashApiKey(key, HASH_SECRET)).toBe(hashApiKey(key, HASH_SECRET));
  });

  it("different key produces different hash", () => {
    const h1 = hashApiKey("key1", HASH_SECRET);
    const h2 = hashApiKey("key2", HASH_SECRET);
    expect(h1).not.toBe(h2);
  });

  it("different secret produces different hash", () => {
    const h1 = hashApiKey("same-key", "secret1");
    const h2 = hashApiKey("same-key", "secret2");
    expect(h1).not.toBe(h2);
  });
});

describe("maskApiKey – masking", () => {
  it("returns first 8 + ... + last 4", () => {
    const key = "sk-rk-abcdefgh1234567890wxyz";
    expect(maskApiKey(key)).toBe("sk-rk-ab...wxyz");
  });

  it("short key returns masked placeholder", () => {
    expect(maskApiKey("short")).toBe("••••••••");
  });
});

describe("timingSafeEqualHex", () => {
  it("returns true for equal hex strings", () => {
    const h = "a".repeat(64);
    expect(timingSafeEqualHex(h, h)).toBe(true);
  });

  it("returns false for different length", () => {
    expect(timingSafeEqualHex("aa", "a")).toBe(false);
  });

  it("returns false for different same-length hex", () => {
    expect(timingSafeEqualHex("a".repeat(64), "b".repeat(64))).toBe(false);
  });
});

describe("round-trip create → verify", () => {
  it("create then store hash then verify(rawKey) succeeds", async () => {
    const storage = createMemoryStorage();
    const { rawKey, hash, id } = createApiKey(HASH_SECRET, "sk-rk");
    await storage.set("user1", id, { id, hash, provider: "openai" });

    const verifier = createKeyVerifier(storage, { hashSecret: HASH_SECRET });
    const result = await verifier.verify(rawKey, "user1");

    expect(result.valid).toBe(true);
    expect(result.keyId).toBe(id);
  });

  it("verify with wrong rawKey returns valid: false", async () => {
    const storage = createMemoryStorage();
    const { hash, id } = createApiKey(HASH_SECRET, "sk-rk");
    await storage.set("user1", id, { id, hash });

    const verifier = createKeyVerifier(storage, { hashSecret: HASH_SECRET });
    const result = await verifier.verify("sk-rk-wrong-key", "user1");

    expect(result.valid).toBe(false);
    expect(result.keyId).toBeUndefined();
  });

  it("verify with wrong userId finds no key", async () => {
    const storage = createMemoryStorage();
    const { rawKey, hash, id } = createApiKey(HASH_SECRET, "sk-rk");
    await storage.set("user1", id, { id, hash });

    const verifier = createKeyVerifier(storage, { hashSecret: HASH_SECRET });
    const result = await verifier.verify(rawKey, "other-user");

    expect(result.valid).toBe(false);
  });
});
