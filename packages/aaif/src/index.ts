export type {
  AAIFRequest,
  AAIFResponse,
  AAIFTask,
  AAIFLatency,
  AAIFConstraints,
  AAIFUser,
  AAIFRouting,
  AAIFRoutingHints,
  AAIFRoutingContext,
  AAIFRoutingPlan,
  AAIFRoutingPlanStep,
  AAIFRoutingAttempt,
  AAIFRoutingAttemptOutcome,
  AAIFIntegrationStack,
  AAIFIntegrationStackComponent,
  AAIFIntegrationStackSchemaVersion,
  // Stage 4.3 — verified-context envelope
  AAIFVerifiedClaimState,
  AAIFEvidenceMatch,
  AAIFVerifiedClaimEvidence,
  AAIFVerifiedClaimJudge,
  AAIFVerifiedClaimEnvelope,
  AAIFVerifiedContextInput,
  AAIFVerifiedContextOutput,
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
  isAAIFRequest,
  isAAIFResponse,
  isAAIFVerifiedClaimEnvelope,
  isAAIFVerifiedContextInput,
  isAAIFVerifiedContextOutput,
} from "./validate.js";

export type { ExecuteAAIFOptions } from "./runtime.js";
export { executeAAIFRequest } from "./runtime.js";

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
