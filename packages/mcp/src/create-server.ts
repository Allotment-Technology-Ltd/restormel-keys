/**
 * Factory and stdio transport for the Restormel MCP server.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readMcpPackageVersion } from "./health-check.js";
import { registerRestormelTools } from "./register-tools.js";

/**
 * Build an MCP server with all Restormel tools registered (stdio not connected).
 */
export function createRestormelMcpServer(): McpServer {
  const server = new McpServer({
    name: "restormel-mcp",
    version: readMcpPackageVersion(),
  });
  registerRestormelTools(server);
  return server;
}

/**
 * Run the server on stdin/stdout (for Cursor, Claude Desktop, etc.).
 * Logs diagnostics to stderr only — never write to stdout except MCP frames.
 */
export async function startStdioRestormelMcpServer(): Promise<void> {
  const server = createRestormelMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[restormel-mcp] stdio transport connected (v${readMcpPackageVersion()}).`);
}
