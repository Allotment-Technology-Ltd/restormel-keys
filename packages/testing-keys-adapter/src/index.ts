/**
 * @restormel/testing-keys-adapter — thin Restormel / Keys resolution seam for Testing (MVP).
 */
export const testingKeysAdapterPackage = "@restormel/testing-keys-adapter" as const;

export { keysAdapterOptionsFromProcessEnv, keysHttpBearerFromProcessEnv } from "./env-from-process.js";
export { resolveModel } from "./adapter.js";
export { readSecretFromEnv } from "./materialize.js";
export { createHttpKeysTransport } from "./transport-http.js";
export { createStubKeysTransport } from "./transport-stub.js";
export type { StubResolutionEntry } from "./transport-stub.js";
export type {
  KeysAdapterError,
  KeysAdapterErrorCode,
  KeysHttpResolveResponseBody,
  KeysModelAdapterOptions,
  KeysResolutionTransport,
  KeysTransportResolution,
  ModelResolutionResult,
  OpenAiEnvFallbackOptions,
  ResolvedModel,
} from "./types.js";
