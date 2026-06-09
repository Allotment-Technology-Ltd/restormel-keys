/**
 * Horizon suite MCP tool names — the SINGLE SOURCE OF TRUTH (Stage 5B / I10).
 *
 * `@restormel/aaif` has zero runtime dependencies, so it is the safe home for the canonical tool
 * name list. `@restormel/mcp` re-exports these (see `packages/mcp/src/suite-tool-names.ts`) rather
 * than maintaining its own copy. Keep `registerHorizonSuiteTools` in `@restormel/mcp` in sync with
 * this list.
 */
export const RESTORMEL_SUITE_TOOL_NAMES = [
  "docs.canonical_resolve",
  "routing.capabilities",
  "testing.config_validate",
  "observability.trace_summarize",
  "graph.fixture_validate",
  "state.memory_preview",
  "connect.verify",
  "connect.search",
  "connect.get_context_for",
  "connect.retrieve",
  "connect.graph.retrieve_context",
  "connect.graph.expand_context",
  "connect.graph.find_relevant_subgraph",
  "connect.graph.find_paths",
  "connect.graph.summarise_subgraph",
  "connect.ingest.start",
  "connect.ingest.status",
] as const;

export type RestormelSuiteToolName = (typeof RESTORMEL_SUITE_TOOL_NAMES)[number];

/** Minimal module flag shape for tool gating (matches the dashboard's ModuleFlags). */
export type SuiteToolModuleFlags = {
  connect?: boolean;
  testing?: boolean;
  graph?: "disabled" | "preview" | "enabled";
};

function isGraphToolEnabled(graph: SuiteToolModuleFlags["graph"]): boolean {
  return graph === "preview" || graph === "enabled";
}

/** Filter suite MCP tool names by resolved module flags. */
export function getEnabledSuiteToolNames(flags: SuiteToolModuleFlags): RestormelSuiteToolName[] {
  return RESTORMEL_SUITE_TOOL_NAMES.filter((name) => {
    if (name.startsWith("connect.")) return flags.connect === true;
    if (name === "testing.config_validate") return flags.testing === true;
    if (name === "graph.fixture_validate") return isGraphToolEnabled(flags.graph);
    return true;
  });
}
