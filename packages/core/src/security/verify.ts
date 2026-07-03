/**
 * Key verifier: portable verify(rawKey) using KeyStorage. No Firestore; works with any KeyStorage.
 * Uses stored hash; timing-safe comparison. Never store or log raw keys.
 */
import type { KeyStorage } from "../storage/types.js";
import { hashApiKey, timingSafeEqualHex } from "./hash.js";

export interface VerifyResult {
  valid: boolean;
  keyId?: string;
}

export interface KeyVerifierOptions {
  /** Secret used when hashing keys (must match the secret used at create/store time). */
  hashSecret: string;
}

/**
 * Create a verifier that checks a raw key against hashes stored in KeyStorage.
 * Storage records must include a "hash" field (hex string) set when the key was created.
 */
export function createKeyVerifier(
  storage: KeyStorage,
  options: KeyVerifierOptions
): {
  verify(rawKey: string, userId: string): Promise<VerifyResult>;
} {
  const { hashSecret } = options;

  return {
    async verify(rawKey: string, userId: string): Promise<VerifyResult> {
      const computedHash = hashApiKey(rawKey, hashSecret);
      const keys = await storage.list(userId);

      for (const key of keys) {
        const storedHash = key.hash as string | undefined;
        if (typeof storedHash !== "string") continue;
        if (timingSafeEqualHex(computedHash, storedHash)) {
          return { valid: true, keyId: key.id };
        }
      }

      return { valid: false };
    },
  };
}
