/**
 * Typed tool catalog — single source of truth for the dev-tools/mcp dashboard page.
 *
 * Combines:
 *   - `ALL_TOOLS` from tools.ts (control-plane / routing / BYOK tools)
 *   - The suite tool names from RESTORMEL_SUITE_TOOL_NAMES (connect.* + horizon tools)
 *     with short descriptions pulled from the registration files.
 *
 * Whenever a new tool is added to either list it will automatically appear in the
 * dashboard catalog — the page test asserts that every RESTORMEL_SUITE_TOOL_NAME is
 * present in CATALOG_ENTRIES.
 *
 * NOTE: this module has NO external runtime dependencies — it can be imported inside
 * the SvelteKit dashboard without dragging in the MCP server or provider SDKs.
 */

import { RESTORMEL_SUITE_TOOL_NAMES, type RestormelSuiteToolName } from "./suite-tool-names.js";
import { ALL_TOOLS } from "./tools.js";

/**
 * Short description for connect.memory.write (mirrors the first line of
 * MEMORY_WRITE_TOOL_DESCRIPTION in connect-memory-write.ts — kept as an inline constant
 * so catalog-export.ts has no Node-only MCP SDK dependency and can be bundled safely).
 */
const MEMORY_WRITE_CATALOG_DESC =
  "Write agent observations into a Restormel Connect knowledge graph as verified-memory claims (POST /connect/v1/memory). Every observation runs the same EBV quality gate as document ingest before persisting.";

export type CatalogEntry = {
  name: string;
  pillar: string;
  description: string;
};

/**
 * Suite tool descriptions (connect.* + horizon).
 * Descriptions are sourced from the registration files to stay DRY.
 */
const SUITE_TOOL_DESCRIPTIONS: Record<RestormelSuiteToolName, { pillar: string; description: string }> = {
  "docs.canonical_resolve": {
    pillar: "Docs",
    description: "Map a canonical topic id to repo path and public URL (offline).",
  },
  "routing.capabilities": {
    pillar: "Routing",
    description: "Describe the routing capabilities available in the current configuration.",
  },
  "testing.config_validate": {
    pillar: "Testing",
    description: "Validate restormel-testing YAML/JSON config offline (size-capped).",
  },
  "observability.trace_summarize": {
    pillar: "Observability",
    description: "Normalize RunTrace JSON and return counts + short summary.",
  },
  "graph.fixture_validate": {
    pillar: "Graph",
    description: "Structural GraphData check (nodes/edges/ghost arrays).",
  },
  "state.memory_preview": {
    pillar: "State",
    description: "Project StateEvent stream to working memory; text lengths only.",
  },
  "connect.verify": {
    pillar: "Connect",
    description: "Claim verification via hosted REST (BYOK LLM routes).",
  },
  "connect.search": {
    pillar: "Connect",
    description: "BYO Surreal graph — semantic search with structured context_pack (hosted retrieve).",
  },
  "connect.get_context_for": {
    pillar: "Connect",
    description: "Topic + optional seed_claim_id traversal on your graph store.",
  },
  "connect.retrieve": {
    pillar: "Connect",
    description: "Deprecated alias for connect.search.",
  },
  "connect.retrieve_verified": {
    pillar: "Connect",
    description:
      "Verified retrieval: returns only EBV-supported claims from the workspace graph (strict trust filter).",
  },
  "connect.memory.write": {
    pillar: "Connect",
    description: MEMORY_WRITE_CATALOG_DESC,
  },
  "connect.graph.retrieve_context": {
    pillar: "Connect",
    description:
      "Primary retrieval: vector-seeded, graph-expanded, token-budgeted context for a query. Trust: supported-only by default.",
  },
  "connect.graph.expand_context": {
    pillar: "Connect",
    description:
      "Graph expansion from explicit seed node ids. Optional edge_types filtering. Trust: supported-only by default.",
  },
  "connect.graph.find_relevant_subgraph": {
    pillar: "Connect",
    description:
      "Topic-driven subgraph with reasoning_mode = semantic | causal | temporal. Trust: supported-only by default.",
  },
  "connect.graph.find_paths": {
    pillar: "Connect",
    description:
      "Ranked reasoning paths between two graph nodes with edge-type filter and max_hops budget.",
  },
  "connect.graph.summarise_subgraph": {
    pillar: "Connect",
    description:
      "Retrieve then condense the subgraph under a token budget — dedup + salience prune, preserving seeds.",
  },
  "connect.ingest.start": {
    pillar: "Connect",
    description: "Start a Connect ingest run from an agent (POST /connect/v1/ingest/start).",
  },
  "connect.ingest.status": {
    pillar: "Connect",
    description: "Poll the status of a running Connect ingest job.",
  },
};

/** Suite tool catalog entries (connect.* + horizon). */
const SUITE_CATALOG: CatalogEntry[] = RESTORMEL_SUITE_TOOL_NAMES.map((name) => {
  const meta = SUITE_TOOL_DESCRIPTIONS[name];
  return {
    name,
    pillar: meta?.pillar ?? "Suite",
    description: meta?.description ?? `${name} — no description registered.`,
  };
});

/** Control-plane + routing + BYOK tool catalog entries. */
const TOOLS_CATALOG: CatalogEntry[] = ALL_TOOLS.map((t) => ({
  name: t.name,
  pillar: inferPillar(t.name),
  description: t.description,
}));

function inferPillar(name: string): string {
  if (name.startsWith("models.") || name.startsWith("providers.") || name.startsWith("cost.")) {
    return "Models";
  }
  if (name.startsWith("routing.") || name.startsWith("routes.") || name.startsWith("fallback_chain.")) {
    return "Routing";
  }
  if (name.startsWith("policies.") || name.startsWith("policy.") || name.startsWith("byok.")) {
    return "Policy";
  }
  if (name.startsWith("testing.") || name.startsWith("readiness.")) {
    return "Testing";
  }
  if (name.startsWith("integration.")) {
    return "Integrations";
  }
  if (name.startsWith("projects.") || name.startsWith("project.") || name.startsWith("project_models.")) {
    return "Projects";
  }
  if (name.startsWith("entitlements.")) {
    return "Entitlements";
  }
  if (name.startsWith("catalog.")) {
    return "Catalog";
  }
  if (name.startsWith("docs.")) {
    return "Docs";
  }
  if (name.startsWith("observability.")) {
    return "Observability";
  }
  if (name.startsWith("state.")) {
    return "State";
  }
  if (name.startsWith("graph.")) {
    return "Graph";
  }
  return "Suite";
}

/**
 * Full generated catalog — suite tools first (Connect act-tier tools most prominent),
 * then control-plane tools. Deduped by name (suite wins).
 */
const suiteNames = new Set(SUITE_CATALOG.map((e) => e.name));
export const CATALOG_ENTRIES: CatalogEntry[] = [
  ...SUITE_CATALOG,
  ...TOOLS_CATALOG.filter((e) => !suiteNames.has(e.name)),
];

/** Set of all registered tool names — used by the completeness test. */
export const REGISTERED_TOOL_NAMES: ReadonlySet<string> = new Set(
  CATALOG_ENTRIES.map((e) => e.name),
);
