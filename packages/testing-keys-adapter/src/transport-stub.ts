import type { KeysResolutionTransport, KeysTransportResolution } from "./types.js";

export interface StubResolutionEntry {
  provider: string;
  model: string;
  /** Name of process.env var holding the provider API key. */
  secretEnvVar: string;
  baseUrl?: string;
}

/** In-memory map for tests and offline development; not a substitute for real Keys in production. */
export function createStubKeysTransport(map: Record<string, StubResolutionEntry>): KeysResolutionTransport {
  return {
    async resolve(logicalRef: string): Promise<KeysTransportResolution> {
      const hit = map[logicalRef];
      if (!hit) {
        return {
          ok: false,
          code: "unknown_ref",
          message: `Stub Keys transport: no entry for logical ref "${logicalRef}"`,
        };
      }
      return {
        ok: true,
        provider: hit.provider,
        model: hit.model,
        secretEnvVar: hit.secretEnvVar,
        baseUrl: hit.baseUrl,
      };
    },
  };
}
