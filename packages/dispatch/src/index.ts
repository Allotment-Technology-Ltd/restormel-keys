export type {
  DispatchRequest,
  DispatchResponse,
  DispatchTask,
  DispatchLatency,
  DispatchConstraints,
  DispatchUser,
  DispatchRouting,
  DispatchRoutingHints,
  DispatchRoutingContext,
  DispatchRoutingPlan,
  DispatchRoutingPlanStep,
  DispatchRoutingAttempt,
  DispatchRoutingAttemptOutcome,
  DispatchIntegrationStack,
  DispatchIntegrationStackComponent,
  DispatchIntegrationStackSchemaVersion,
  // Stage 4.3 — verified-context envelope
  DispatchVerifiedClaimState,
  DispatchEvidenceMatch,
  DispatchVerifiedClaimEvidence,
  DispatchVerifiedClaimJudge,
  DispatchVerifiedClaimEnvelope,
  DispatchVerifiedContextInput,
  DispatchVerifiedContextOutput,
} from "./types.js";

export {
  INTEGRATION_STACK_SCHEMA_VERSION,
  INTEGRATION_COMPONENT_IDS,
  INTEGRATION_CATALOG,
  INTEGRATION_STACK_TEMPLATES,
  STACK_LAYER_ORDER,
  STACK_LAYERS,
  isIntegrationComponentId,
} from "./integration-stack-catalog.js";
export type {
  IntegrationComponentId,
  IntegrationCatalogCategory,
  IntegrationCatalogEntry,
  IntegrationStackTemplateId,
  StackLayer,
} from "./integration-stack-catalog.js";

/** Horizon suite MCP tool names — single source of truth (Stage 5B / I10); `@restormel/mcp` re-exports these. */
export {
  RESTORMEL_SUITE_TOOL_NAMES,
  getEnabledSuiteToolNames,
  type RestormelSuiteToolName,
  type SuiteToolModuleFlags,
} from "./suite-tool-names.js";

export {
  isDispatchRequest,
  isDispatchResponse,
  isDispatchVerifiedClaimEnvelope,
  isDispatchVerifiedContextInput,
  isDispatchVerifiedContextOutput,
} from "./validate.js";

export type { ExecuteDispatchOptions } from "./runtime.js";
export { executeDispatchRequest } from "./runtime.js";

// Stage 4.3 — verified-context runtime helpers
export {
  summariseVerifiedClaims,
  filterClaimsByState,
  allClaimsSupported,
  hasContradictedClaims,
  buildVerifiedContextInput,
  buildVerifiedContextOutput,
  getRequestVerifiedContext,
  getResponseVerifiedContext,
  getSupportedClaims,
} from "./verified-context.js";

// Deprecated AAIF* aliases (pre-1.0 grace period — no silent breaking rename).
// Removed at 1.0; migrate to the Dispatch* names. See ./deprecated.ts.
export * from "./deprecated.js";
