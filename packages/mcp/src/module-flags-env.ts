/**
 * Parse RESTORMEL_MODULE_FLAGS for stdio MCP (mirrors dashboard module-flags env override).
 */
import type { SuiteToolModuleFlags } from "./suite-tool-names.js";

const MVP_MCP_FLAGS: SuiteToolModuleFlags = {
  connect: true,
  testing: false,
  graph: "disabled",
};

function parseGraphToken(raw: string): SuiteToolModuleFlags["graph"] | null {
  const s = raw.trim().toLowerCase();
  if (s === "graph" || s === "graph:enabled" || s === "enabled") return "enabled";
  if (s === "graph:preview" || s === "preview") return "preview";
  if (s === "graph:disabled" || s === "disabled") return "disabled";
  return null;
}

/** Resolve suite tool module flags from env (MVP defaults when unset). */
export function resolveMcpModuleFlagsFromEnv(): SuiteToolModuleFlags {
  const raw = process.env.RESTORMEL_MODULE_FLAGS?.trim();
  if (!raw) return { ...MVP_MCP_FLAGS };

  const flags: SuiteToolModuleFlags = {
    connect: false,
    testing: false,
    graph: "disabled",
  };

  for (const part of raw.split(",")) {
    const token = part.trim().toLowerCase();
    if (!token || token === "keys" || token === "keys-only") continue;

    const graphMode = parseGraphToken(token);
    if (graphMode) {
      flags.graph = graphMode;
      continue;
    }

    switch (token) {
      case "connect":
        flags.connect = true;
        break;
      case "testing":
        flags.testing = true;
        break;
      default:
        break;
    }
  }

  return flags;
}
