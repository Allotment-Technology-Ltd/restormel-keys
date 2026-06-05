/** Cursor / Claude Desktop `mcp.json` fragment for Connect agent tools. */
export function buildConnectMcpSnippet(params: {
  connectApiBase: string;
  workspaceId: string;
  gatewayKey: string;
  projectId?: string | null;
}): string {
  const env: Record<string, string> = {
    RESTORMEL_CONNECT_API_BASE: params.connectApiBase,
    RESTORMEL_GATEWAY_KEY: params.gatewayKey,
    RESTORMEL_WORKSPACE_ID: params.workspaceId,
  };
  if (params.projectId) {
    env.RESTORMEL_PROJECT_ID = params.projectId;
  }
  const fragment = {
    mcpServers: {
      restormel: {
        command: "npx",
        args: ["-y", "@restormel/mcp"],
        env,
      },
    },
  };
  return `${JSON.stringify(fragment, null, 2)}\n`;
}
