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
  | "state.memory_preview"
  | "connect.verify"
  | "connect.search"
  | "connect.get_context_for"
  | "connect.retrieve"
  | "connect.graph.retrieve_context"
  | "connect.graph.expand_context"
  | "connect.graph.find_relevant_subgraph"
  | "connect.graph.find_paths"
  | "connect.graph.summarise_subgraph"
  | "connect.ingest.start"
  | "connect.ingest.status";
