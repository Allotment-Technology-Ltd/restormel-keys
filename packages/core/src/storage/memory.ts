/**
 * In-memory KeyStorage. Map-based; no persistence. Fully functional for tests and single-process use.
 */
import type { KeyStorage, StoredKey, StoredUsage, UsageResult } from "./types.js";

export function createMemoryStorage(): KeyStorage {
  const keys = new Map<string, Map<string, StoredKey>>();
  const usage = new Map<string, Map<string, StoredUsage>>();

  function userKeys(userId: string): Map<string, StoredKey> {
    let m = keys.get(userId);
    if (!m) {
      m = new Map();
      keys.set(userId, m);
    }
    return m;
  }

  function userUsage(userId: string): Map<string, StoredUsage> {
    let m = usage.get(userId);
    if (!m) {
      m = new Map();
      usage.set(userId, m);
    }
    return m;
  }

  return {
    async get(userId: string, keyId: string): Promise<StoredKey | null> {
      return userKeys(userId).get(keyId) ?? null;
    },

    async list(userId: string): Promise<StoredKey[]> {
      return Array.from(userKeys(userId).values());
    },

    async set(userId: string, keyId: string, value: StoredKey): Promise<void> {
      userKeys(userId).set(keyId, { ...value, id: keyId });
    },

    async delete(userId: string, keyId: string): Promise<void> {
      userKeys(userId).delete(keyId);
      userUsage(userId).delete(keyId);
    },

    async getUsage(userId: string, keyId?: string): Promise<UsageResult> {
      const u = userUsage(userId);
      if (keyId !== undefined) {
        const one = u.get(keyId) ?? null;
        return one ?? [];
      }
      return Array.from(u.values());
    },

    async trackUsage(userId: string, keyId: string, usageEntry: StoredUsage): Promise<void> {
      userUsage(userId).set(keyId, { ...usageEntry, keyId });
    },
  };
}
