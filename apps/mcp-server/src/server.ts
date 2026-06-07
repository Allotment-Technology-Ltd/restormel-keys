/**
 * server — builds the McpServer with all five knowledge tools registered,
 * bound to the orchestrator + config produced by startup.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "./config.js";
import type { GraphRuntime } from "./graph-store.js";
import type { ToolContext } from "./tools/_shared.js";
import { registerRetrieveContext } from "./tools/retrieve-context.js";
import { registerExpandContext } from "./tools/expand-context.js";
import { registerFindRelevantSubgraph } from "./tools/find-relevant-subgraph.js";
import { registerFindPaths } from "./tools/find-paths.js";
import { registerInspectQuery } from "./tools/inspect-query.js";

export const SERVER_NAME = "restormel-mcp-server";
export const SERVER_VERSION = "0.1.0";

/** Build an McpServer with every tool registered (transport not yet connected). */
export function buildServer(config: ServerConfig, runtime: GraphRuntime): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const ctx: ToolContext = { orchestrator: runtime.orchestrator, config };

  registerRetrieveContext(server, ctx);
  registerExpandContext(server, ctx);
  registerFindRelevantSubgraph(server, ctx);
  registerFindPaths(server, ctx);
  registerInspectQuery(server, ctx);

  return server;
}
