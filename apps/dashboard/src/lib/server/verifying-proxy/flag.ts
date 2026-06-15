/**
 * Verifying-proxy remote feature flag (REC-PLAN-011, Phase C).
 *
 * The remote, multi-tenant connect-to-Claude path is HARD-gated on D1 (Ory Hydra)
 * and is NOT live yet. Phase C builds and tests the OAuth resource-server auth
 * machinery *behind this flag* so the remote path is ready, not live — there is no
 * public `/mcp` route and no ingress in this phase.
 *
 * Default OFF. Merging Phase C changes NO prod runtime behaviour: nothing in the
 * running app reads this flag to expose a live endpoint. It exists so a later
 * go-live step (after the security review + Hydra provisioned) can enable the
 * remote path explicitly.
 */

const ENV_VAR = "RESTORMEL_VERIFYING_PROXY_REMOTE";

/** Parse a boolean-ish env token. Fail closed: anything not explicitly truthy is OFF. */
function parseEnabled(raw: string | undefined): boolean {
  const token = (raw ?? "").trim().toLowerCase();
  return token === "1" || token === "true" || token === "on" || token === "enabled";
}

/**
 * Whether the verifying-proxy *remote* path is enabled. Default OFF.
 *
 * Reads `process.env` lazily so tests can set/unset it per case without a module
 * reload, and so the flag is never captured at import time.
 */
export function isVerifyingProxyRemoteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseEnabled(env[ENV_VAR]);
}

export const VERIFYING_PROXY_REMOTE_ENV_VAR = ENV_VAR;
