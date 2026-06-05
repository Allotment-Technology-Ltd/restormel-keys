import { describe, expect, it } from "vitest";
import { buildConnectMcpSnippet } from "./connect-mcp-snippet";

describe("buildConnectMcpSnippet", () => {
  it("produces valid JSON with escaped special characters in env values", () => {
    const snippet = buildConnectMcpSnippet({
      connectApiBase: "https://restormel.dev",
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      gatewayKey: 'rk_abc"injection\\trail',
      projectId: "660e8400-e29b-41d4-a716-446655440001",
    });
    const parsed = JSON.parse(snippet) as {
      mcpServers: { restormel: { env: Record<string, string> } };
    };
    expect(parsed.mcpServers.restormel.env.RESTORMEL_GATEWAY_KEY).toBe('rk_abc"injection\\trail');
    expect(parsed.mcpServers.restormel.env.RESTORMEL_PROJECT_ID).toBe(
      "660e8400-e29b-41d4-a716-446655440001",
    );
  });

  it("omits project id when not provided", () => {
    const snippet = buildConnectMcpSnippet({
      connectApiBase: "https://restormel.dev",
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      gatewayKey: "rk_abcdefghijklmnopqrstuvwx",
    });
    const parsed = JSON.parse(snippet) as {
      mcpServers: { restormel: { env: Record<string, string> } };
    };
    expect(parsed.mcpServers.restormel.env.RESTORMEL_PROJECT_ID).toBeUndefined();
  });
});
