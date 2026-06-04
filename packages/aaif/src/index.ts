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

/** Horizon suite MCP tool names (duplicated here so `@restormel/aaif` builds without `@restormel/mcp`). */
export type { RestormelSuiteToolName } from "./suite-tool-names.js";

export { isAAIFRequest, isAAIFResponse } from "./validate.js";

export type { ExecuteAAIFOptions } from "./runtime.js";
export { executeAAIFRequest } from "./runtime.js";
