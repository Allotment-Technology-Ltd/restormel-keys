/**
 * Suite-wide MCP tools (Horizon Phase 1). Keep in sync with {@link registerHorizonSuiteTools}.
 */
export const RESTORMEL_SUITE_TOOL_NAMES = [
  "docs.canonical_resolve",
  "routing.capabilities",
  "testing.config_validate",
  "observability.trace_summarize",
  "graph.fixture_validate",
  "state.memory_preview",
] as const;

export type RestormelSuiteToolName = (typeof RESTORMEL_SUITE_TOOL_NAMES)[number];
