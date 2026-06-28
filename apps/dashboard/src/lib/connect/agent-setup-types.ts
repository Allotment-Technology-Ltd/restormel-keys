export type ConnectAgentGatewayKey = {
  id: string;
  keyPrefix: string;
  projectId: string;
  projectName: string;
  /** Server-persisted label (W3.7/K1 — nullable for pre-migration keys). */
  label?: string | null;
  /**
   * RES-113 PR-L — enforced connection scope persisted on the key (migration 074). Null on legacy/
   * flat keys (and whenever the onboardingJourney flag is OFF). Lets the M4 manager render a stored
   * key as a typed connection with a REAL access badge instead of a label-derived guess.
   */
  keyType?: "mcp" | "rest" | null;
  access?: "read" | "read_write" | null;
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
