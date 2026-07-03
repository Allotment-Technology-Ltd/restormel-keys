import type { ArtifactPolicy, EnvironmentProfile, RetryPolicy, TestSuite } from "@restormel/testing-core";

/** Supported config document versions. */
export const SUPPORTED_SCHEMA_VERSIONS = ["1"] as const;
export type SupportedSchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

/** Defaults applied to suites that omit the corresponding fields. */
export interface ConfigDefaults {
  retryPolicy?: RetryPolicy;
  defaultTimeoutMs?: number;
  artifactPolicy?: ArtifactPolicy;
}

/**
 * Normalised, validated workspace config (no file paths — portable object graph).
 */
export interface RestormelTestingConfig {
  schemaVersion: SupportedSchemaVersion;
  /** Global Keys logical refs; merged with per-environment keys at runtime. */
  keys: Record<string, string>;
  defaults?: ConfigDefaults;
  environments: Record<string, EnvironmentProfile>;
  suites: TestSuite[];
  /** Opaque hook ids → commands or module paths (runner-defined). */
  adapterHooks: Record<string, string>;
  /** Override `baseUrl` for an environment id (e.g. CI preview URL). */
  targetUrlOverrides: Record<string, string>;
}

export interface ConfigError {
  path: string;
  message: string;
  code: string;
}

export type LoadConfigSuccess = {
  ok: true;
  config: RestormelTestingConfig;
};

export type LoadConfigFailure = {
  ok: false;
  errors: ConfigError[];
};

export type LoadConfigResult = LoadConfigSuccess | LoadConfigFailure;
