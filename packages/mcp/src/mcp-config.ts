/**
 * Optional RESTORMEL_MCP_CONFIG: path to JSON KeysConfig for entitlements.check.
 * Parsed once per process; invalid JSON falls back to built-in default.
 */
import { readFileSync, existsSync } from "node:fs";
import type { KeysConfig } from "@restormel/keys";

const DEFAULT_MCP_CONFIG: KeysConfig = {
  plans: [
    {
      id: "mcp-local",
      name: "MCP local default",
      entitlements: { allowedModels: ["*"] },
    },
  ],
};

let cached: KeysConfig | null = null;
let cachedPath: string | null = null;

export function getMcpKeysConfig(): KeysConfig {
  const path = process.env.RESTORMEL_MCP_CONFIG?.trim();
  if (!path) return DEFAULT_MCP_CONFIG;

  if (cached && cachedPath === path) return cached;

  if (!existsSync(path)) {
    cached = DEFAULT_MCP_CONFIG;
    cachedPath = path;
    return cached;
  }

  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as KeysConfig;
    cached = parsed && typeof parsed === "object" ? parsed : DEFAULT_MCP_CONFIG;
  } catch {
    cached = DEFAULT_MCP_CONFIG;
  }
  cachedPath = path;
  return cached;
}
