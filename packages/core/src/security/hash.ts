/**
 * Gateway Key hashing and masking (dashboard keys, format rk_... / sk-rk-...).
 * Uses Node.js crypto (createHmac, timingSafeEqual, randomBytes). Never store or log raw keys.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_PREFIX = "sk-rk";
const HMAC_ALG = "sha256";
const RANDOM_BYTES = 24;
const MASK_FIRST = 8;
const MASK_LAST = 4;

export interface CreateApiKeyResult {
  rawKey: string;
  hash: string;
  id: string;
}

/**
 * Generate a new Gateway Key: prefix + random, HMAC-SHA256 hash, and a short ID for lookup.
 * Returns raw key (show once to user), hash (store this, not raw), and id (storage key).
 * @param hashSecret - Secret for HMAC (required).
 * @param prefix - Key prefix (default "sk-rk").
 */
export function createApiKey(hashSecret: string, prefix: string = DEFAULT_PREFIX): CreateApiKeyResult {
  const randomPart = randomBytes(RANDOM_BYTES).toString("hex");
  const rawKey = `${prefix}-${randomPart}`;
  const hash = hashApiKey(rawKey, hashSecret);
  const id = `rk_${hash.slice(0, 12)}`;
  return { rawKey, hash, id };
}

/**
 * Deterministic HMAC-SHA256 of the raw key. Use the same hashSecret when verifying.
 */
export function hashApiKey(rawKey: string, hashSecret: string): string {
  const hmac = createHmac(HMAC_ALG, hashSecret);
  hmac.update(rawKey, "utf8");
  return hmac.digest("hex");
}

/**
 * Mask for display: first 8 + '...' + last 4. Never log or display full key.
 */
export function maskApiKey(rawKey: string): string {
  if (rawKey.length <= MASK_FIRST + MASK_LAST) return "••••••••";
  return rawKey.slice(0, MASK_FIRST) + "..." + rawKey.slice(-MASK_LAST);
}

/**
 * Timing-safe comparison of two hex hashes (same length).
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
