/**
 * Storage adapter tests: full CRUD lifecycle, user isolation, encrypted values in localStorage.
 */
import { describe, it, expect } from "vitest";
import {
  createMemoryStorage,
  createEncryptedLocalStorage,
  type StorageLike,
  type StoredKey,
  type StoredUsage,
} from "./index.js";

describe("memory storage – full CRUD lifecycle", () => {
  const store = createMemoryStorage();
  const userId = "user1";

  it("list returns empty when no keys", async () => {
    const list = await store.list(userId);
    expect(list).toEqual([]);
  });

  it("get returns null for missing key", async () => {
    expect(await store.get(userId, "k1")).toBeNull();
  });

  it("set then get returns stored key", async () => {
    const key: StoredKey = { id: "k1", provider: "openai", label: "My key" };
    await store.set(userId, "k1", key);
    const got = await store.get(userId, "k1");
    expect(got).not.toBeNull();
    expect(got!.id).toBe("k1");
    expect(got!.provider).toBe("openai");
    expect(got!.label).toBe("My key");
  });

  it("list returns all keys for user", async () => {
    await store.set(userId, "k2", { id: "k2", provider: "anthropic" });
    const list = await store.list(userId);
    expect(list.length).toBe(2);
    expect(list.map((k) => k.id).sort()).toEqual(["k1", "k2"]);
  });

  it("delete removes key", async () => {
    await store.delete(userId, "k1");
    expect(await store.get(userId, "k1")).toBeNull();
    const list = await store.list(userId);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("k2");
  });

  it("getUsage returns empty when no usage", async () => {
    const u = await store.getUsage(userId);
    expect(Array.isArray(u)).toBe(true);
    expect((u as StoredUsage[]).length).toBe(0);
  });

  it("trackUsage then getUsage returns usage", async () => {
    const usage: StoredUsage = { keyId: "k2", usage: { inputTokens: 100, outputTokens: 50 } };
    await store.trackUsage(userId, "k2", usage);
    const one = await store.getUsage(userId, "k2");
    expect(Array.isArray(one) ? one.length : 1).toBe(1);
    const u = Array.isArray(one) ? one[0] : one;
    expect(u.keyId).toBe("k2");
    expect(u.usage?.inputTokens).toBe(100);
    expect(u.usage?.outputTokens).toBe(50);
  });

  it("getUsage(userId) returns all usage", async () => {
    const all = await store.getUsage(userId);
    expect(Array.isArray(all)).toBe(true);
    expect((all as StoredUsage[]).length).toBe(1);
  });
});

describe("memory storage – user isolation", () => {
  const store = createMemoryStorage();

  it("user A cannot see user B keys", async () => {
    await store.set("userA", "key1", { id: "key1", provider: "openai" });
    await store.set("userB", "key2", { id: "key2", provider: "anthropic" });

    const listA = await store.list("userA");
    const listB = await store.list("userB");

    expect(listA.length).toBe(1);
    expect(listB.length).toBe(1);
    expect(listA[0].id).toBe("key1");
    expect(listB[0].id).toBe("key2");
    expect(await store.get("userA", "key2")).toBeNull();
    expect(await store.get("userB", "key1")).toBeNull();
  });
});

describe("encrypted-local – encrypted values in localStorage", () => {
  function mockStorage(): StorageLike & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem(key: string) {
        return data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        data.set(key, value);
      },
      removeItem(key: string) {
        data.delete(key);
      },
      key(index: number) {
        const keys = [...data.keys()];
        return keys[index] ?? null;
      },
      get length() {
        return data.size;
      },
    };
  }

  it("stored value is not plaintext", async () => {
    const storage = mockStorage();
    const passphrase = "test-secret";
    const store = createEncryptedLocalStorage({ storage, passphrase });

    const key: StoredKey = { id: "k1", provider: "openai", label: "secret key" };
    await store.set("u1", "k1", key);

    const raw = storage.getItem("rk_u1_key_k1");
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("openai");
    expect(raw).not.toContain("secret key");
  });

  it("round-trip decrypts to same key", async () => {
    const storage = mockStorage();
    const store = createEncryptedLocalStorage({ storage, passphrase: "pw" });

    const key: StoredKey = { id: "id1", provider: "google", label: "my label" };
    await store.set("user1", "id1", key);
    const got = await store.get("user1", "id1");
    expect(got).not.toBeNull();
    expect(got!.id).toBe("id1");
    expect(got!.provider).toBe("google");
    expect(got!.label).toBe("my label");
  });

  it("all keys use rk_ prefix", async () => {
    const storage = mockStorage();
    const store = createEncryptedLocalStorage({ storage, passphrase: "x" });
    await store.set("u", "k", { id: "k" });

    for (const k of storage.data.keys()) {
      expect(k.startsWith("rk_")).toBe(true);
    }
  });

  it("full CRUD and usage with encrypted-local", async () => {
    const storage = mockStorage();
    const store = createEncryptedLocalStorage({ storage, passphrase: "crud" });

    await store.set("u", "k1", { id: "k1", provider: "openai" });
    await store.set("u", "k2", { id: "k2", provider: "anthropic" });
    expect(await store.list("u")).toHaveLength(2);
    expect(await store.get("u", "k1")).toMatchObject({ id: "k1", provider: "openai" });

    await store.trackUsage("u", "k1", { keyId: "k1", usage: { inputTokens: 10 } });
    const usage = await store.getUsage("u", "k1");
    const u = Array.isArray(usage) ? usage[0] : usage;
    expect(u?.usage?.inputTokens).toBe(10);

    await store.delete("u", "k1");
    expect(await store.get("u", "k1")).toBeNull();
    expect(await store.list("u")).toHaveLength(1);
  });
});
