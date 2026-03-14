/**
 * KeyStorage backed by localStorage with AES-GCM encryption. PBKDF2 key derivation.
 * All keys use 'rk_' prefix. Requires Web Crypto API (browser or Node 19+).
 */
import type { KeyStorage, StoredKey, StoredUsage, UsageResult } from "./types.js";

const PREFIX = "rk_";
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

function keyIdsKey(userId: string): string {
  return `${PREFIX}${userId}_key_ids`;
}

function keyDataKey(userId: string, keyId: string): string {
  return `${PREFIX}${userId}_key_${keyId}`;
}

function usageKey(userId: string, keyId: string): string {
  return `${PREFIX}${userId}_usage_${keyId}`;
}

function saltKey(): string {
  return `${PREFIX}salt`;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  cryptoApi: Crypto
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey", "deriveBits"]
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(
  plain: string,
  key: CryptoKey,
  iv: Uint8Array,
  cryptoApi: Crypto
): Promise<Uint8Array> {
  const cipher = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plain)
  );
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipher), iv.length);
  return combined;
}

async function decrypt(
  combined: Uint8Array,
  key: CryptoKey,
  cryptoApi: Crypto
): Promise<string> {
  const iv = combined.subarray(0, IV_LENGTH);
  const cipher = combined.subarray(IV_LENGTH);
  const dec = await cryptoApi.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    cipher as BufferSource
  );
  return new TextDecoder().decode(dec);
}

function b64Encode(u: Uint8Array): string {
  return btoa(String.fromCharCode(...u));
}

function b64Decode(s: string): Uint8Array {
  return new Uint8Array(
    atob(s)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
}

export interface EncryptedLocalOptions {
  /** localStorage-like (getItem, setItem, removeItem, key, length). */
  storage: StorageLike;
  /** Passphrase for PBKDF2 key derivation. */
  passphrase: string;
  /** Crypto implementation (default globalThis.crypto). */
  crypto?: Crypto;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  get length(): number;
}

export function createEncryptedLocalStorage(options: EncryptedLocalOptions): KeyStorage {
  const { storage, passphrase, crypto: cryptoApi = globalThis.crypto } = options;

  let cachedKey: CryptoKey | null = null;
  let cachedSalt: Uint8Array | null = null;

  async function getSalt(): Promise<Uint8Array> {
    if (cachedSalt) return cachedSalt;
    const sk = saltKey();
    const existing = storage.getItem(sk);
    if (existing) {
      cachedSalt = b64Decode(existing);
      return cachedSalt;
    }
    const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_LENGTH));
    storage.setItem(sk, b64Encode(salt));
    cachedSalt = salt;
    return salt;
  }

  async function getEncryptionKey(): Promise<CryptoKey> {
    if (cachedKey) return cachedKey;
    const salt = await getSalt();
    cachedKey = await deriveKey(passphrase, salt, cryptoApi);
    return cachedKey;
  }

  async function writeEncrypted(key: string, value: string): Promise<void> {
    const encKey = await getEncryptionKey();
    const iv = cryptoApi.getRandomValues(new Uint8Array(IV_LENGTH));
    const combined = await encrypt(value, encKey, iv, cryptoApi);
    storage.setItem(key, b64Encode(combined));
  }

  async function readEncrypted(key: string): Promise<string | null> {
    const raw = storage.getItem(key);
    if (raw == null) return null;
    const encKey = await getEncryptionKey();
    const combined = b64Decode(raw);
    try {
      return await decrypt(combined, encKey, cryptoApi);
    } catch {
      return null;
    }
  }

  function getKeyIds(userId: string): string[] {
    const raw = storage.getItem(keyIdsKey(userId));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  function setKeyIds(userId: string, ids: string[]): void {
    storage.setItem(keyIdsKey(userId), JSON.stringify(ids));
  }

  return {
    async get(userId: string, keyId: string): Promise<StoredKey | null> {
      const raw = await readEncrypted(keyDataKey(userId, keyId));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StoredKey;
      } catch {
        return null;
      }
    },

    async list(userId: string): Promise<StoredKey[]> {
      const ids = getKeyIds(userId);
      const out: StoredKey[] = [];
      for (const id of ids) {
        const raw = await readEncrypted(keyDataKey(userId, id));
        if (raw) {
          try {
            out.push(JSON.parse(raw) as StoredKey);
          } catch {
            /* skip */
          }
        }
      }
      return out;
    },

    async set(userId: string, keyId: string, value: StoredKey): Promise<void> {
      const ids = getKeyIds(userId);
      if (!ids.includes(keyId)) {
        ids.push(keyId);
        setKeyIds(userId, ids);
      }
      const payload = JSON.stringify({ ...value, id: keyId });
      await writeEncrypted(keyDataKey(userId, keyId), payload);
    },

    async delete(userId: string, keyId: string): Promise<void> {
      const ids = getKeyIds(userId).filter((id) => id !== keyId);
      setKeyIds(userId, ids);
      storage.removeItem(keyDataKey(userId, keyId));
      storage.removeItem(usageKey(userId, keyId));
    },

    async getUsage(userId: string, keyId?: string): Promise<UsageResult> {
      if (keyId !== undefined) {
        const raw = await readEncrypted(usageKey(userId, keyId));
        if (!raw) return [];
        try {
          return JSON.parse(raw) as StoredUsage;
        } catch {
          return [];
        }
      }
      const ids = getKeyIds(userId);
      const out: StoredUsage[] = [];
      for (const id of ids) {
        const raw = await readEncrypted(usageKey(userId, id));
        if (raw) {
          try {
            out.push(JSON.parse(raw) as StoredUsage);
          } catch {
            /* skip */
          }
        }
      }
      return out;
    },

    async trackUsage(userId: string, keyId: string, usageEntry: StoredUsage): Promise<void> {
      const payload = JSON.stringify({ ...usageEntry, keyId });
      await writeEncrypted(usageKey(userId, keyId), payload);
    },
  };
}
