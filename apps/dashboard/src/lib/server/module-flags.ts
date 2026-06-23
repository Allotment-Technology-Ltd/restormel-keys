/**
 * Restormel suite module flags — PostHog (canonical) with RESTORMEL_MODULE_FLAGS env override.
 * When override is unset and POSTHOG_API_KEY is missing, MVP defaults apply (fail-closed to Keys+Connect).
 */
import {
  MVP_MODULE_DEFAULTS,
  POSTHOG_MODULE_FLAG_KEYS,
  POSTHOG_CONNECT_HOST_MANAGED_GRAPH_STORE_LEGACY_KEY,
  type GraphModuleMode,
  type ModuleFlagKey,
  type ModuleFlags,
} from "$lib/module-flags-types";

export type { GraphModuleMode, ModuleFlagKey, ModuleFlags };
export { MVP_MODULE_DEFAULTS, POSTHOG_MODULE_FLAG_KEYS };

const ENV_VAR = "RESTORMEL_MODULE_FLAGS";

/** Process-level cache for PostHog global flag payloads (60s TTL). */
let posthogCache: { flags: ModuleFlags; expiresAt: number } | null = null;
const POSTHOG_CACHE_MS = 60_000;

function parseGraphToken(raw: string): GraphModuleMode | null {
  const s = raw.trim().toLowerCase();
  if (s === "graph" || s === "graph:enabled" || s === "enabled") return "enabled";
  if (s === "graph:preview" || s === "preview") return "preview";
  if (s === "graph:disabled" || s === "disabled") return "disabled";
  return null;
}

function parseEnvOverride(raw: string | undefined): ModuleFlags | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const flags: ModuleFlags = {
    connect: false,
    testing: false,
    graph: "disabled",
    gatewayProviders: false,
    guardrails: false,
    environments: false,
    modelPools: false,
    hostedRuntime: false,
    catalogExternalSignals: false,
    connectHostManagedGraphStore: false,
    monitor: false,
    fromEnvOverride: true,
  };

  for (const part of trimmed.split(",")) {
    const token = part.trim().toLowerCase();
    if (!token || token === "keys" || token === "keys-only") continue;

    const graphMode = parseGraphToken(token);
    if (graphMode) {
      flags.graph = graphMode;
      continue;
    }

    switch (token) {
      case "connect":
        flags.connect = true;
        break;
      case "testing":
        flags.testing = true;
        break;
      case "gateway_providers":
      case "gateway-providers":
        flags.gatewayProviders = true;
        break;
      case "guardrails":
        flags.guardrails = true;
        break;
      case "environments":
        flags.environments = true;
        break;
      case "model_pools":
      case "model-pools":
        flags.modelPools = true;
        break;
      case "hosted_runtime":
      case "hosted-runtime":
        flags.hostedRuntime = true;
        break;
      case "catalog_external_signals":
      case "catalog-external-signals":
        flags.catalogExternalSignals = true;
        break;
      // New canonical tokens + permanent back-compat aliases for the host-managed
      // Postgres graph store (REC-ADR-008). The old `connect_neon_graph_store` tokens
      // stay so existing Coolify `RESTORMEL_MODULE_FLAGS` values keep enabling it.
      case "connect_host_managed_graph_store":
      case "connect-host-managed-graph-store":
      case "connect_neon_graph_store":
      case "connect-neon-graph-store":
        flags.connectHostManagedGraphStore = true;
        break;
      case "monitor":
        flags.monitor = true;
        break;
      default:
        break;
    }
  }

  return flags;
}

function graphFromPostHogValue(value: unknown): GraphModuleMode {
  if (value === "preview" || value === "enabled") return value;
  return "disabled";
}

/**
 * Map a raw PostHog `/decide` featureFlags payload to resolved module flags.
 * Exported for test coverage of the REC-ADR-008 host-managed graph-store dual-read.
 */
export function flagsFromPostHogPayload(payload: Record<string, unknown>): ModuleFlags {
  return {
    connect: payload[POSTHOG_MODULE_FLAG_KEYS.connect] === true,
    testing: payload[POSTHOG_MODULE_FLAG_KEYS.testing] === true,
    graph: graphFromPostHogValue(payload[POSTHOG_MODULE_FLAG_KEYS.graph]),
    gatewayProviders: payload[POSTHOG_MODULE_FLAG_KEYS.gatewayProviders] === true,
    guardrails: payload[POSTHOG_MODULE_FLAG_KEYS.guardrails] === true,
    environments: payload[POSTHOG_MODULE_FLAG_KEYS.environments] === true,
    modelPools: payload[POSTHOG_MODULE_FLAG_KEYS.modelPools] === true,
    hostedRuntime: payload[POSTHOG_MODULE_FLAG_KEYS.hostedRuntime] === true,
    catalogExternalSignals: payload[POSTHOG_MODULE_FLAG_KEYS.catalogExternalSignals] === true,
    // REC-ADR-008 dual-read: accept the new key OR the legacy `…-neon-graph-store` key
    // until the EU PostHog flag is re-keyed, so an env with the rollout ON does not
    // silently revert to the MVP default (OFF).
    connectHostManagedGraphStore:
      payload[POSTHOG_MODULE_FLAG_KEYS.connectHostManagedGraphStore] === true ||
      payload[POSTHOG_CONNECT_HOST_MANAGED_GRAPH_STORE_LEGACY_KEY] === true,
    monitor: payload[POSTHOG_MODULE_FLAG_KEYS.monitor] === true,
    fromEnvOverride: false,
  };
}

async function fetchPostHogModuleFlags(distinctId: string): Promise<ModuleFlags | null> {
  const apiKey = (process.env.POSTHOG_API_KEY ?? process.env.PUBLIC_POSTHOG_KEY ?? "").trim();
  if (!apiKey) return null;

  const host = (process.env.POSTHOG_HOST ?? process.env.PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com")
    .replace(/\/+$/, "")
    .replace("eu.posthog.com", "eu.i.posthog.com")
    .replace("us.posthog.com", "us.i.posthog.com");

  try {
    const res = await fetch(`${host}/decide?v=3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        distinct_id: distinctId,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      featureFlags?: Record<string, boolean | string>;
    };
    const ff = data.featureFlags ?? {};
    return flagsFromPostHogPayload(ff as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function getPostHogCachedFlags(distinctId: string): Promise<ModuleFlags | null> {
  const now = Date.now();
  if (posthogCache && posthogCache.expiresAt > now) {
    return posthogCache.flags;
  }
  const flags = await fetchPostHogModuleFlags(distinctId);
  if (flags) {
    posthogCache = { flags, expiresAt: now + POSTHOG_CACHE_MS };
  }
  return flags;
}

/** Resolve module flags for this request (env override → PostHog → MVP defaults). */
export async function resolveModuleFlags(distinctId = "restormel-server"): Promise<ModuleFlags> {
  const envFlags = parseEnvOverride(process.env[ENV_VAR]);
  if (envFlags) return envFlags;

  const posthogFlags = await getPostHogCachedFlags(distinctId);
  if (posthogFlags) return posthogFlags;

  return { ...MVP_MODULE_DEFAULTS };
}

/** Sync resolve for code paths that cannot await (uses env or MVP defaults only). */
export function resolveModuleFlagsSync(): ModuleFlags {
  return parseEnvOverride(process.env[ENV_VAR]) ?? { ...MVP_MODULE_DEFAULTS };
}

export function isModuleEnabled(flags: ModuleFlags, key: ModuleFlagKey): boolean {
  switch (key) {
    case "connect":
      return flags.connect;
    case "testing":
      return flags.testing;
    case "gatewayProviders":
      return flags.gatewayProviders;
    case "guardrails":
      return flags.guardrails;
    case "environments":
      return flags.environments;
    case "modelPools":
      return flags.modelPools;
    case "hostedRuntime":
      return flags.hostedRuntime;
    case "catalogExternalSignals":
      return flags.catalogExternalSignals;
    case "connectHostManagedGraphStore":
      return flags.connectHostManagedGraphStore;
    case "monitor":
      return flags.monitor;
    case "graph":
      return flags.graph !== "disabled";
    default:
      return false;
  }
}

export function isGraphPreview(flags: ModuleFlags): boolean {
  return flags.graph === "preview";
}

export function isGraphFullyEnabled(flags: ModuleFlags): boolean {
  return flags.graph === "enabled";
}

/** Derive dashboard UI hidden sections from module flags (merged with RESTORMEL_DASHBOARD_UI_HIDDEN). */
export function moduleFlagsToDashboardUiHidden(flags: ModuleFlags): string[] {
  const hidden: string[] = [];
  if (!flags.testing) hidden.push("copy-for-ci");
  if (!flags.guardrails) hidden.push("policies");
  if (!flags.gatewayProviders) {
    // Connections nav stays for direct providers; no extra hide token.
  }
  if (!flags.modelPools) {
    // Route advanced UI gated in components, not nav.
  }
  if (!flags.hostedRuntime) {
    // Sandbox runtime invoke gated in API.
  }
  if (!flags.monitor) {
    hidden.push("analytics", "logs", "healthcheck");
  }
  return hidden;
}
