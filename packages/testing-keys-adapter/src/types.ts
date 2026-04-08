import type { KeysModelMeta } from "@restormel/testing-core";

/**
 * Documented HTTP contract (placeholder until Keys publishes a stable public API).
 * Keys should respond with 200 and this JSON shape. Adapter does not implement Keys-side logic.
 */
export interface KeysHttpResolveResponseBody {
  provider: string;
  model: string;
  /** Environment variable name holding the provider API key (BYOK), not the secret value. */
  secretEnvVar: string;
  /** Optional OpenAI-compatible API base URL. */
  baseUrl?: string;
}

export interface ResolvedModel {
  /** Safe to log and attach to RunRecord.keysModelMeta. */
  meta: KeysModelMeta;
  /** Provider API model id for requests. */
  modelId: string;
  /** OpenAI-compatible base URL if applicable. */
  providerBaseUrl?: string;
  /**
   * In-memory credentials only. Never JSON.stringify, log, or write to artefacts.
   */
  credentials: { apiKey: string };
}

export type KeysAdapterErrorCode =
  | "invalid_ref"
  | "keys_not_configured"
  | "keys_unreachable"
  | "keys_rejected"
  | "keys_missing_secret_binding"
  | "fallback_disabled"
  | "fallback_missing_env";

export interface KeysAdapterError {
  code: KeysAdapterErrorCode;
  message: string;
  cause?: unknown;
}

export type ModelResolutionResult =
  | { ok: true; model: ResolvedModel; warnings: string[] }
  | { ok: false; error: KeysAdapterError };

/** Swappable transport: HTTP to Keys, in-memory stub, or future SDK. */
export interface KeysResolutionTransport {
  resolve(logicalRef: string): Promise<KeysTransportResolution>;
}

export type KeysTransportResolution =
  | {
      ok: true;
      provider: string;
      model: string;
      secretEnvVar: string;
      baseUrl?: string;
    }
  | { ok: false; code: string; message: string; cause?: unknown };

/**
 * When Keys cannot resolve, optionally use a single OpenAI-compatible env key (documented escape hatch).
 */
export interface OpenAiEnvFallbackOptions {
  enabled: boolean;
  /** Env var for the API key (default OPENAI_API_KEY). */
  apiKeyEnvVar?: string;
  /** Model id when using fallback (default gpt-4o-mini). */
  defaultModel?: string;
  /** Optional base URL (default official API). */
  baseUrl?: string;
  /** Logical ref this fallback applies to; if omitted, applies to any ref when Keys fails. */
  forLogicalRef?: string;
}

export interface KeysModelAdapterOptions {
  /**
   * Try transport first (Keys). If unset and no fallback, resolution fails unless you inject a transport via factory.
   */
  transport?: KeysResolutionTransport;
  /** POST JSON to `${baseUrl}/v1/testing/resolve-model` when transport not passed explicitly. */
  keysApiBaseUrl?: string;
  /** Env var holding bearer token for the Keys HTTP API (optional). */
  keysApiTokenEnvVar?: string;
  openAiEnvFallback?: OpenAiEnvFallbackOptions;
}
