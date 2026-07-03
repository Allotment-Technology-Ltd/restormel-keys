/**
 * @restormel/testing-config — load and validate `restormel-testing` workspace config.
 */
export const testingConfigPackage = "@restormel/testing-config" as const;

export type {
  ConfigDefaults,
  ConfigError,
  LoadConfigFailure,
  LoadConfigResult,
  LoadConfigSuccess,
  RestormelTestingConfig,
  SupportedSchemaVersion,
} from "./schema.js";
export { SUPPORTED_SCHEMA_VERSIONS } from "./schema.js";
export { loadConfigFromFile, loadConfigFromString } from "./load.js";
export type { ConfigStringFormat, LoadConfigFromFileOptions } from "./load.js";
export {
  isOpaqueKeyRef,
  isSafeHttpUrl,
  looksLikeInlineSecret,
} from "./refs.js";
export {
  formatConfigErrors,
  resolvedKeysForEnvironment,
  resolveEnvironmentProfile,
  resolveSuite,
  validateConfigDocument,
  validateMvpRunnerRestrictions,
} from "./validate.js";
