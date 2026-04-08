import type { KeysModelAdapterOptions } from "./types.js";

/**
 * Build Keys adapter options from documented environment variables (CLI, GitHub Action, local).
 *
 * | Variable | Purpose |
 * |----------|---------|
 * | `RESTORMEL_KEYS_API_BASE_URL` | Keys HTTP API origin (e.g. `https://keys.example.com`). Enables POST `/v1/testing/resolve-model`. |
 * | `RESTORMEL_KEYS_API_TOKEN_ENV` | Optional. Name of env var holding the **Keys API** bearer token (default `RESTORMEL_KEYS_API_TOKEN`). Values are never logged. |
 * | `RESTORMEL_TESTING_OPENAI_FALLBACK` | Set to `1` to allow documented OpenAI-compatible env fallback when Keys is unset or resolution fails (`OPENAI_API_KEY`). |
 */
export function keysAdapterOptionsFromProcessEnv(): KeysModelAdapterOptions | undefined {
  const baseUrl = process.env.RESTORMEL_KEYS_API_BASE_URL?.trim();
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
