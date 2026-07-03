/**
 * Non-interactive MCP manifest for CI and operator smoke tests (`restormel-mcp --check`).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_TOOLS } from "./tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function readMcpPackageVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export type McpHealthCheckResult = {
  ok: boolean;
  name: string;
  version: string;
  tools: { name: string }[];
  error?: string;
};

export function runMcpHealthCheck(): McpHealthCheckResult {
  const version = readMcpPackageVersion();
  try {
    const names = [...new Set(ALL_TOOLS.map((t) => t.name))].sort();
    return {
      ok: true,
      name: "@restormel/mcp",
      version,
      tools: names.map((name) => ({ name })),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      name: "@restormel/mcp",
      version,
      tools: [],
      error: message,
    };
  }
}
