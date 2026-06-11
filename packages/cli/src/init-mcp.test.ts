/**
 * Unit tests for init-mcp config emission.
 * No network calls, no file system writes — all assertions are pure.
 */
import { describe, it, expect } from "vitest";
import {
  buildMcpConfig,
  buildMcpClientConfig,
  formatMcpConfig,
  mcpConfigFilePaths,
  MCP_CLIENTS,
  MCP_CLIENT_LABELS,
  ENV_PLACEHOLDER as EP,
  type McpClient,
  type McpEnvBlock,
} from "./init-mcp.js";

const TEST_ENV: McpEnvBlock = {
  RESTORMEL_GATEWAY_KEY: "rk_live_test123",
  RESTORMEL_CONNECT_API_BASE: "https://restormel.dev",
  RESTORMEL_WORKSPACE_ID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
};

describe("buildMcpConfig", () => {
  for (const client of MCP_CLIENTS) {
    it(`${client}: command is npx`, () => {
      const cfg = buildMcpConfig(client, TEST_ENV);
      expect(cfg.command).toBe("npx");
    });

    it(`${client}: args contain @restormel/mcp@latest`, () => {
      const cfg = buildMcpConfig(client, TEST_ENV);
      expect(cfg.args.join(" ")).toContain("@restormel/mcp@latest");
    });

    it(`${client}: env contains all three required keys`, () => {
      const cfg = buildMcpConfig(client, TEST_ENV);
      expect(cfg.env.RESTORMEL_GATEWAY_KEY).toBe(TEST_ENV.RESTORMEL_GATEWAY_KEY);
      expect(cfg.env.RESTORMEL_CONNECT_API_BASE).toBe(TEST_ENV.RESTORMEL_CONNECT_API_BASE);
      expect(cfg.env.RESTORMEL_WORKSPACE_ID).toBe(TEST_ENV.RESTORMEL_WORKSPACE_ID);
    });

    it(`${client}: env never contains extra keys beyond the three documented ones`, () => {
      const cfg = buildMcpConfig(client, TEST_ENV);
      const envKeys = Object.keys(cfg.env).sort();
      expect(envKeys).toEqual(
        ["RESTORMEL_CONNECT_API_BASE", "RESTORMEL_GATEWAY_KEY", "RESTORMEL_WORKSPACE_ID"].sort(),
      );
    });
  }
});

describe("buildMcpClientConfig", () => {
  for (const client of MCP_CLIENTS) {
    it(`${client}: wraps server block under mcpServers.restormel`, () => {
      const config = buildMcpClientConfig(client, TEST_ENV);
      expect(config).toHaveProperty("mcpServers");
      expect(config.mcpServers).toHaveProperty("restormel");
      expect(config.mcpServers.restormel.command).toBe("npx");
    });
  }
});

describe("formatMcpConfig", () => {
  for (const client of MCP_CLIENTS) {
    it(`${client}: is valid JSON`, () => {
      const json = formatMcpConfig(client, TEST_ENV);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it(`${client}: JSON round-trips to buildMcpClientConfig`, () => {
      const json = formatMcpConfig(client, TEST_ENV);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(buildMcpClientConfig(client, TEST_ENV));
    });

    it(`${client}: does NOT contain the real key literal when using placeholders`, () => {
      // Guards against accidentally emitting real credentials in the default output.
      const json = formatMcpConfig(client);
      // Placeholder contains angle brackets, not a real rk_ key
      expect(json).toContain("<your-gateway-key>");
      expect(json).not.toMatch(/rk_live_/);
    });
  }
});

describe("mcpConfigFilePaths", () => {
  it("claude-code: returns ~/.claude.json", () => {
    const paths = mcpConfigFilePaths("claude-code");
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain(".claude.json");
  });

  it("claude-desktop: returns two paths (macOS + Windows)", () => {
    const paths = mcpConfigFilePaths("claude-desktop");
    expect(paths).toHaveLength(2);
    expect(paths.some((p) => p.includes("Application Support"))).toBe(true);
    expect(paths.some((p) => p.includes("APPDATA"))).toBe(true);
  });

  it("cursor: returns ~/.cursor/mcp.json", () => {
    const paths = mcpConfigFilePaths("cursor");
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain(".cursor/mcp.json");
  });
});

describe("MCP_CLIENTS", () => {
  it("contains all three supported clients", () => {
    expect(MCP_CLIENTS).toContain("claude-code");
    expect(MCP_CLIENTS).toContain("claude-desktop");
    expect(MCP_CLIENTS).toContain("cursor");
  });
});

describe("MCP_CLIENT_LABELS", () => {
  it("has a label for every client in MCP_CLIENTS", () => {
    for (const client of MCP_CLIENTS) {
      expect(MCP_CLIENT_LABELS[client]).toBeTruthy();
    }
  });
});

describe("default ENV_PLACEHOLDER", () => {
  it("uses placeholder strings, not real credentials", () => {
    expect(EP.RESTORMEL_GATEWAY_KEY).toContain("<");
    expect(EP.RESTORMEL_WORKSPACE_ID).toContain("<");
  });

  it("connects to the canonical hosted base URL", () => {
    expect(EP.RESTORMEL_CONNECT_API_BASE).toBe("https://restormel.dev");
  });
});
