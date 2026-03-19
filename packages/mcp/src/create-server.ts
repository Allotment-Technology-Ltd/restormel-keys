/**
 * Factory and stdio transport for the Restormel MCP server.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerRestormelTools } from "./register-tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readPackageVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Build an MCP server with all Restormel tools registered (stdio not connected).
 */
export function createRestormelMcpServer(): McpServer {
  const server = new McpServer({
    name: "restormel-mcp",
    version: readPackageVersion(),
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
  console.error(`[restormel-mcp] stdio transport connected (v${readPackageVersion()}).`);
}
