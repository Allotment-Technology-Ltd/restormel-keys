/**
 * Storage adapter types. KeyStorage is user-scoped; never expose raw keys in logs.
 */

/**
 * Provider credential metadata stored via an adapter.
 *
 * NOTE: This record is intentionally generic: in integration-first mode, adapters may store
 * only references/metadata rather than raw secret material. Avoid treating this as “vault custody”.
 */
export interface CredentialRecord {
  id: string;
  provider?: string;
  label?: string;
  [key: string]: unknown;
}

/** Backwards-compatible alias. Prefer `CredentialRecord`. */
export type StoredKey = CredentialRecord;

/** Usage entry for one key (e.g. token counts). */
export interface StoredUsage {
  keyId: string;
  /** e.g. inputTokens, outputTokens */
  usage?: Record<string, number>;
  [key: string]: unknown;
}

/** Result of getUsage: one key or aggregate. */
export type UsageResult = StoredUsage | StoredUsage[];

export interface KeyStorage {
  get(userId: string, keyId: string): Promise<StoredKey | null>;
  list(userId: string): Promise<StoredKey[]>;
  set(userId: string, keyId: string, value: StoredKey): Promise<void>;
  delete(userId: string, keyId: string): Promise<void>;
  getUsage(userId: string, keyId?: string): Promise<UsageResult>;
  trackUsage(userId: string, keyId: string, usage: StoredUsage): Promise<void>;
}
