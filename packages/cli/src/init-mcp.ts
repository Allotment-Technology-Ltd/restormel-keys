/**
 * init-mcp — config emitter for `keys init --mcp`.
 *
 * Generates the ready-to-paste MCP server block for the three supported
 * clients (Claude Code, Claude Desktop, Cursor). No network calls; no secrets.
 *
 * Ledger citations (read-only, proven rows only per Stage 4.2 scope contract):
 *   Row 4 — "Unsupported claims are excluded, not blended" (strict mode)
 *   Row 7 — "Every claim carries a provenance trace" (trace_export_url)
 */

export type McpClient = "claude-code" | "claude-desktop" | "cursor";

export const MCP_CLIENTS: readonly McpClient[] = ["claude-code", "claude-desktop", "cursor"];

/**
 * The env block an operator must populate before the server can serve claims.
 * These are ALL documented in packages/mcp/README.md; no new names introduced.
 */
export interface McpEnvBlock {
  /** Gateway key (rk_…) — never committed, always injected at runtime. */
  RESTORMEL_GATEWAY_KEY: string;
  /** Base URL of the hosted Connect REST API. */
  RESTORMEL_CONNECT_API_BASE: string;
  /** Workspace UUID from the Connect hub. */
  RESTORMEL_WORKSPACE_ID: string;
}

export const ENV_PLACEHOLDER: McpEnvBlock = {
  RESTORMEL_GATEWAY_KEY: "<your-gateway-key>",
  RESTORMEL_CONNECT_API_BASE: "https://restormel.dev",
  RESTORMEL_WORKSPACE_ID: "<your-workspace-id>",
};

/**
 * Build the MCP server config object for a given client.
 *
 * All clients use `npx` to run the published `restormel-mcp` binary so the
 * config works on a fresh machine without a global install. Callers can
 * substitute the env values before writing to disk.
 */
export function buildMcpConfig(client: McpClient, env: McpEnvBlock = ENV_PLACEHOLDER): McpServerBlock {
  const serverBlock: McpServerBlock = {
    command: "npx",
    args: ["-y", "@restormel/mcp@latest"],
    env: {
      RESTORMEL_GATEWAY_KEY: env.RESTORMEL_GATEWAY_KEY,
      RESTORMEL_CONNECT_API_BASE: env.RESTORMEL_CONNECT_API_BASE,
      RESTORMEL_WORKSPACE_ID: env.RESTORMEL_WORKSPACE_ID,
    },
  };

  switch (client) {
    case "claude-code":
      return buildClaudeCodeBlock(serverBlock);
    case "claude-desktop":
      return buildClaudeDesktopBlock(serverBlock);
    case "cursor":
      return buildCursorBlock(serverBlock);
  }
}

/** MCP server entry used in all three client config shapes. */
export interface McpServerEntry {
  command: string;
  args: string[];
  env: McpEnvBlock;
}

/** The full config block emitted for one client. */
export interface McpServerBlock {
  command: string;
  args: string[];
  env: McpEnvBlock;
}

function buildClaudeCodeBlock(entry: McpServerEntry): McpServerBlock {
  return entry;
}

function buildClaudeDesktopBlock(entry: McpServerEntry): McpServerBlock {
  return entry;
}

function buildCursorBlock(entry: McpServerEntry): McpServerBlock {
  return entry;
}

/** The JSON wrapper shape expected by each client's config file. */
export interface McpClientConfig {
  mcpServers: Record<string, McpServerBlock>;
}

/**
 * Emit the full JSON config for a given client, wrapped in the `mcpServers`
 * object the client config files expect.
 *
 * Config file locations per client:
 *   claude-code   — ~/.claude.json  (global) or .claude.json in the project root
 *   claude-desktop — ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
 *                    %APPDATA%\Claude\claude_desktop_config.json (Windows)
 *   cursor        — ~/.cursor/mcp.json
 */
export function buildMcpClientConfig(
  client: McpClient,
  env: McpEnvBlock = ENV_PLACEHOLDER,
): McpClientConfig {
  return {
    mcpServers: {
      restormel: buildMcpConfig(client, env),
    },
  };
}

/**
 * Stringify the config as pretty-printed JSON (matching the format the client
 * apps expect and humans can paste).
 */
export function formatMcpConfig(client: McpClient, env: McpEnvBlock = ENV_PLACEHOLDER): string {
  return JSON.stringify(buildMcpClientConfig(client, env), null, 2);
}

/**
 * The human-readable file path for each client's config file.
 * Returned as an array so the CLI can display the macOS/Windows variant.
 */
export function mcpConfigFilePaths(client: McpClient): string[] {
  switch (client) {
    case "claude-code":
      return ["~/.claude.json"];
    case "claude-desktop":
      return [
        "~/Library/Application Support/Claude/claude_desktop_config.json (macOS)",
        "%APPDATA%\\Claude\\claude_desktop_config.json (Windows)",
      ];
    case "cursor":
      return ["~/.cursor/mcp.json"];
  }
}

/** Human-readable label for each client. */
export const MCP_CLIENT_LABELS: Record<McpClient, string> = {
  "claude-code": "Claude Code",
  "claude-desktop": "Claude Desktop",
  cursor: "Cursor",
};
