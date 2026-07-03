#!/usr/bin/env node
/**
 * CLI entry: `restormel-mcp` — Model Context Protocol server (stdio), or `--check` / `tools --json` for CI.
 */
import { createRestormelMcpServer, startStdioRestormelMcpServer } from "./create-server.js";
import { runMcpHealthCheck } from "./health-check.js";

const argv = process.argv.slice(2);

if (argv[0] === "--check") {
  try {
    createRestormelMcpServer();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const version = runMcpHealthCheck().version;
    console.log(JSON.stringify({ ok: false, name: "@restormel/mcp", version, tools: [], error: message }));
    process.exit(1);
  }
  const result = runMcpHealthCheck();
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

if (argv[0] === "tools" && argv[1] === "--json") {
  try {
    createRestormelMcpServer();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const version = runMcpHealthCheck().version;
    console.log(JSON.stringify({ ok: false, name: "@restormel/mcp", version, tools: [], error: message }));
    process.exit(1);
  }
  const result = runMcpHealthCheck();
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

await startStdioRestormelMcpServer().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[restormel-mcp] Fatal:", message);
  process.exit(1);
});
