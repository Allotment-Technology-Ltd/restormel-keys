/**
 * connect.graph.find_paths — path reasoning between two graph nodes. Returns
 * ranked paths (shortest-first, then by edge-prior product) or an empty list
 * with a reason when none exist within max_hops.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { fromUnknown } from "../errors.js";
import { mcpResult, traceSummary, workspaceFields, type ToolContext } from "./_shared.js";

export function registerFindPaths(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "connect.graph.find_paths",
    {
      description:
        "Path reasoning between two graph nodes. Returns ranked paths with the relations along each (node_ids, relations, score), or an empty list with a reason when none exists within max_hops.",
      inputSchema: {
        source_node_id: z.string().min(1),
        target_node_id: z.string().min(1),
        max_hops: z.number().int().positive().max(8).optional(),
        edge_types: z.array(z.string().min(1)).max(20).optional(),
        ...workspaceFields,
      },
    },
    async (args) => {
      try {
        const result = await ctx.orchestrator.findPaths({
          sourceNodeId: args.source_node_id,
          targetNodeId: args.target_node_id,
          maxHops: args.max_hops,
          edgeTypes: args.edge_types,
        });
        return mcpResult({
          paths: result.paths,
          trace_summary: traceSummary(result.trace),
        });
      } catch (err) {
        return mcpResult(fromUnknown(err, "find_paths"));
      }
    },
  );
}
