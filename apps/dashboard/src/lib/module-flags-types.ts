/** Graph module visibility (PostHog multivariate `restormel-module-graph`). */
export type GraphModuleMode = "disabled" | "preview" | "enabled";

/** Resolved Restormel suite module flags (server + client layout data). */
export type ModuleFlags = {
  connect: boolean;
  testing: boolean;
  graph: GraphModuleMode;
  gatewayProviders: boolean;
  guardrails: boolean;
  environments: boolean;
  modelPools: boolean;
  hostedRuntime: boolean;
  catalogExternalSignals: boolean;
  /**
   * Host-managed Postgres graph store: one-click graph spine reusing the dashboard's own
   * server-side DATABASE_URL (self-hosted EU Postgres — no credentials surfaced). Default off
   * — BYO Surreal only for MVP. Renamed from `connectNeonGraphStore` (REC-ADR-008); the old
   * env tokens and PostHog key stay back-compat aliases.
   */
  connectHostManagedGraphStore: boolean;
  /** Usage, logs, and health dashboard (Monitor nav). Default off — coming-soon shell tracks interest. */
  monitor: boolean;
  /** True when RESTORMEL_MODULE_FLAGS env override is active (skips PostHog). */
  fromEnvOverride: boolean;
};

export type ModuleFlagKey =
  | "connect"
  | "testing"
  | "graph"
  | "gatewayProviders"
  | "guardrails"
  | "environments"
  | "modelPools"
  | "hostedRuntime"
  | "catalogExternalSignals"
  | "connectHostManagedGraphStore"
  | "monitor";

/** PostHog feature flag keys (EU project 123553). */
export const POSTHOG_MODULE_FLAG_KEYS = {
  connect: "restormel-module-connect",
  testing: "restormel-module-testing",
  graph: "restormel-module-graph",
  gatewayProviders: "restormel-module-gateway-providers",
  guardrails: "restormel-module-guardrails",
  environments: "restormel-module-environments",
  modelPools: "restormel-module-model-pools",
  hostedRuntime: "restormel-module-hosted-runtime",
  catalogExternalSignals: "restormel-module-catalog-external-signals",
  connectHostManagedGraphStore: "restormel-module-connect-host-managed-graph-store",
  monitor: "restormel-module-monitor",
} as const;

/**
 * Back-compat alias for the host-managed graph-store PostHog key (REC-ADR-008 rename).
 * The EU PostHog project's flag is still keyed under the old name until it is migrated, so
 * PostHog payload reads MUST dual-read the new key OR this alias — otherwise any env with the
 * rollout ON silently reverts to the MVP default (OFF). Remove only after the EU flag is
 * re-keyed to `restormel-module-connect-host-managed-graph-store`.
 */
export const POSTHOG_CONNECT_HOST_MANAGED_GRAPH_STORE_LEGACY_KEY =
  "restormel-module-connect-neon-graph-store" as const;

/** MVP production defaults (match PostHog rollouts configured 2026-06-03). */
export const MVP_MODULE_DEFAULTS: ModuleFlags = {
  connect: true,
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
  fromEnvOverride: false,
};

/** Module flags for dashboard API tests that exercise full Keys control-plane behavior. */
export const KEYS_API_TEST_MODULE_FLAGS: ModuleFlags = {
  ...MVP_MODULE_DEFAULTS,
  environments: true,
  guardrails: true,
  hostedRuntime: true,
  catalogExternalSignals: true,
  gatewayProviders: true,
};
