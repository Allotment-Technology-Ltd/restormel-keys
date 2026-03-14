/**
 * Storage adapter types. KeyStorage is user-scoped; never expose raw keys in logs.
 */

/** A stored key record (opaque payload; adapter may encrypt). */
export interface StoredKey {
  id: string;
  provider?: string;
  label?: string;
  [key: string]: unknown;
}

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
