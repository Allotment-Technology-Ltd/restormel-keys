/**
 * Core type definitions for Restormel Keys.
 * Headless BYOK and provider-routing; no UI dependencies.
 */

export type ProviderId = string;

export interface KeyConfig {
  provider: ProviderId;
  /** Masked for logs; never expose raw key in UI or errors. */
  label?: string;
  [key: string]: unknown;
}

export type KeyStatus = "active" | "pending_validation" | "invalid" | "revoked";

export interface KeyRecord extends KeyConfig {
  id: string;
  status?: KeyStatus;
  validatedAt?: string;
  /** ISO 8601; when the record was last updated (e.g. after revalidation or status change). */
  updatedAt?: string;
  lastError?: string;
  fingerprint?: string;
  metadata?: Record<string, unknown>;
}

export interface KeyAddResult {
  ok: boolean;
  error?: string;
  savedKey?: KeyRecord;
}

export interface KeyRemoveResult {
  ok: boolean;
  error?: string;
}

export interface ModelDefinition {
  id: string;
  provider: ProviderId;
  /** Optional display name. */
  label?: string;
  [key: string]: unknown;
}

export interface RoutingConfig {
  /** Default provider when no route matches. */
  defaultProvider?: ProviderId;
  /** Model or provider routing rules. */
  rules?: unknown[];
  [key: string]: unknown;
}

export interface EntitlementConfig {
  /** Plan or tier identifier. */
  planId?: string;
  /** Limits, quotas, etc. */
  limits?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PlanDefinition {
  id: string;
  name?: string;
  entitlements?: EntitlementConfig;
  [key: string]: unknown;
}

export interface KeysConfig {
  keys?: KeyConfig[];
  models?: ModelDefinition[];
  routing?: RoutingConfig;
  plans?: PlanDefinition[];
  [key: string]: unknown;
}

export interface CostEstimate {
  /** Provider or model identifier. */
  id: string;
  /** Estimated cost (e.g. per 1k tokens). */
  estimate?: number;
  unit?: string;
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  [key: string]: unknown;
}

export interface ResolvedRoute {
  provider: ProviderId;
  model?: string;
  [key: string]: unknown;
}

export interface UsageRecord {
  provider?: ProviderId;
  model?: string;
  /** Token or request counts, etc. */
  usage?: Record<string, number>;
  [key: string]: unknown;
}

export interface UsageSummary {
  byProvider?: Record<ProviderId, unknown>;
  total?: Record<string, number>;
  [key: string]: unknown;
}

export interface EntitlementResult {
  allowed: boolean;
  remaining?: number;
  limit?: number;
  [key: string]: unknown;
}
