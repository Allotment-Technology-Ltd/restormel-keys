export type { McpToolSchema } from "./tools.js";

/** Generated tool catalog — single source of truth for the dev-tools/mcp dashboard page. */
export { CATALOG_ENTRIES, REGISTERED_TOOL_NAMES, type CatalogEntry } from "./catalog-export.js";

export type { RestormelSuiteToolName, SuiteToolModuleFlags } from "./suite-tool-names.js";
export { RESTORMEL_SUITE_TOOL_NAMES, getEnabledSuiteToolNames } from "./suite-tool-names.js";
export { CANONICAL_DOC_TOPICS } from "./canonical-docs.js";

export {
  modelsListTool,
  providersValidateTool,
  costEstimateTool,
  routingExplainTool,
  entitlementsCheckTool,
  integrationGenerateTool,
  docsSearchTool,
  projectsListTool,
  projectModelsListTool,
  testingJourneyTool,
  testingCiEnvTemplateTool,
  testingResolveProbeTool,
  projectEnvironmentsListTool,
  testingHubSnapshotTool,
  projectGatewayKeysListTool,
  projectGatewayKeysCreateTool,
  projectGatewayKeysDeleteTool,
  routesListTool,
  routesCreateTool,
  routesUpdateTool,
  routesDeleteTool,
  routesUpsertWithStepsTool,
  routesSimulateTool,
  routingExportTool,
  routingImportTool,
  routingExplainChainTool,
  policiesListTool,
  policiesCreateTool,
  policiesUpdateTool,
  policiesDeleteTool,
  fallbackChainSetTool,
  integrationBootstrapNextjsTool,
  byokSchemaGenerateTool,
  byokApiContractGenerateTool,
  policySimulateTool,
  catalogSyncCheckTool,
  catalogDeprecationAlertsTool,
  readinessCheckTool,
  docsCanonicalResolveTool,
  testingConfigValidateTool,
  observabilityTraceSummarizeTool,
  graphFixtureValidateTool,
  stateMemoryPreviewTool,
  ALL_TOOLS,
} from "./tools.js";

export { createRestormelMcpServer, startStdioRestormelMcpServer } from "./create-server.js";

/** Offline doc index — shared with `@restormel/support` / Restormel Support. */
export { searchDocs, DOC_INDEX, type DocIndexEntry } from "./docs-index.js";

/** Shared by HTTP suite invoke (`/api/suite/invoke`) and stdio MCP tools. */
export {
  suiteMemoryPreview,
  suiteResolveCanonical,
  suiteSummarizeTrace,
  suiteValidateGraphFixture,
  suiteValidateTestingConfig,
} from "./suite-tools-logic.js";
