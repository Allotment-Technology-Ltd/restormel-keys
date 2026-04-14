/**
 * Horizon suite MCP tool names — keep in sync with `packages/mcp/src/suite-tool-names.ts`
 * and `registerHorizonSuiteTools` in `@restormel/mcp`.
 */
export type RestormelSuiteToolName =
  | "docs.canonical_resolve"
  | "routing.capabilities"
  | "testing.config_validate"
  | "observability.trace_summarize"
  | "graph.fixture_validate"
  | "state.memory_preview";
