import type { KeysModelAdapterOptions } from "./types.js";

/**
 * Bearer token for `POST …/v1/testing/resolve-model` from process env.
 * Precedence: `RESTORMEL_KEYS_API_TOKEN_ENV` (if set) → that var; else `RESTORMEL_KEYS_API_TOKEN`;
 * else `RESTORMEL_GATEWAY_KEY`; else `RESTORMEL_SERVER_TOKEN`.
 * Values are never logged by callers.
 */
export function keysHttpBearerFromProcessEnv(keysApiTokenEnvVar?: string): string | undefined {
  const customName = keysApiTokenEnvVar?.trim();
  if (customName) {
    const fromCustom = process.env[customName]?.trim();
    if (fromCustom) return fromCustom;
  }
  return (
    process.env.RESTORMEL_KEYS_API_TOKEN?.trim() ||
    process.env.RESTORMEL_GATEWAY_KEY?.trim() ||
    process.env.RESTORMEL_SERVER_TOKEN?.trim()
  );
}

/**
 * Build Keys adapter options from documented environment variables (CLI, GitHub Action, local).
 *
 * | Variable | Purpose |
 * |----------|---------|
 * | `RESTORMEL_KEYS_API_BASE_URL` | Keys HTTP API origin (e.g. `https://keys.example.com`). Enables POST `/v1/testing/resolve-model`. If unset, `RESTORMEL_KEYS_BASE` is used (same shape: site origin, no path). |
 * | `RESTORMEL_KEYS_BASE` | Canonical site origin when `RESTORMEL_KEYS_API_BASE_URL` is not set. |
 * | `RESTORMEL_KEYS_API_TOKEN_ENV` | Optional. Name of env var holding the **Keys HTTP** bearer token (default `RESTORMEL_KEYS_API_TOKEN`). Values are never logged. |
 * | `RESTORMEL_KEYS_API_TOKEN` | Compatibility alias for the Gateway key on HTTP resolve calls. |
 * | `RESTORMEL_GATEWAY_KEY` / `RESTORMEL_SERVER_TOKEN` | Canonical Gateway key; used when API-token vars are unset. |
 * | `RESTORMEL_TESTING_OPENAI_FALLBACK` | Set to `1` to allow documented OpenAI-compatible env fallback when Keys is unset or resolution fails (`OPENAI_API_KEY`). |
 */
export function keysAdapterOptionsFromProcessEnv(): KeysModelAdapterOptions | undefined {
  const baseUrl =
    process.env.RESTORMEL_KEYS_API_BASE_URL?.trim() || process.env.RESTORMEL_KEYS_BASE?.trim();
  const tokenEnvName =
    process.env.RESTORMEL_KEYS_API_TOKEN_ENV?.trim() || "RESTORMEL_KEYS_API_TOKEN";
  const fallbackOn = process.env.RESTORMEL_TESTING_OPENAI_FALLBACK?.trim() === "1";

  const opts: KeysModelAdapterOptions = {};
  if (baseUrl) {
    opts.keysApiBaseUrl = baseUrl;
    opts.keysApiTokenEnvVar = tokenEnvName;
  }
  if (fallbackOn) {
    opts.openAiEnvFallback = { enabled: true };
  }

  if (!opts.keysApiBaseUrl && !opts.openAiEnvFallback) {
    return undefined;
  }
  return opts;
}
