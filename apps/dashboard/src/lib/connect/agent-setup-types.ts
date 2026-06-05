export type ConnectAgentGatewayKey = {
  id: string;
  keyPrefix: string;
  projectId: string;
  projectName: string;
};

export type ConnectAgentSetupData = {
  workspaceId: string;
  projectId: string | null;
  surrealStoreReady: boolean;
  /** Workspace Neon / Postgres one-click store (REST retrieve; MCP needs Surreal). */
  workspaceStoreReady?: boolean;
  modelsReady: boolean;
  hasGraph: boolean;
  agentReady: boolean;
  graphTargetStatus: string | null;
  connectApiBase: string;
  projects: { id: string; name: string }[];
  gatewayKeys: ConnectAgentGatewayKey[];
  defaultProjectId: string | null;
};
