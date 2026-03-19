#!/usr/bin/env node
/**
 * CLI entry: `restormel-mcp` — Model Context Protocol server (stdio).
 */
import { startStdioRestormelMcpServer } from "./create-server.js";

await startStdioRestormelMcpServer().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[restormel-mcp] Fatal:", message);
  process.exit(1);
});
