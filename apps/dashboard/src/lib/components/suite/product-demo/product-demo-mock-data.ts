import type { ConnectIngestStageProgress } from "@restormel/connect-core/ingest/worker-stub";

/** Mid-flight ingest run — mirrors ConnectIngestRunConsole at ~71%. */
export const DEMO_INGEST_JOB = {
  label: "Ingest Gutenberg – Large Text – 01",
  id: "ingest-demo-gutenberg-01",
  status: "running" as const,
  percent: 71,
  processed: 5,
  total: 7,
  currentStage: "remediating" as const,
  currentAction: "Fixing low-confidence nodes",
};

export const DEMO_INGEST_STAGES: ConnectIngestStageProgress[] = [
  { stage: "extracting", status: "completed", progress: { percent: 100, processed: 1, total: 1, eta_seconds: 0 } },
  { stage: "relating", status: "completed", progress: { percent: 100, processed: 1, total: 1, eta_seconds: 0 } },
  { stage: "grouping", status: "completed", progress: { percent: 100, processed: 1, total: 1, eta_seconds: 0 } },
  { stage: "embedding", status: "completed", progress: { percent: 100, processed: 1, total: 1, eta_seconds: 0 } },
  { stage: "validating", status: "completed", progress: { percent: 100, processed: 1, total: 1, eta_seconds: 0 } },
  {
    stage: "remediating",
    status: "running",
    progress: { percent: 45, processed: 2, total: 4, eta_seconds: 18 },
  },
  { stage: "storing", status: "pending" },
];

export const DEMO_DOMAIN_INTENT =
  "This graph should capture ideas, inventions, and people from the history of printing and movable type. Focus on causal relationships between technological developments.";

export const DEMO_DOMAIN_DRAFT = {
  unitTypes: "Invention · Person · Institution · Concept",
  relations: "influenced → · created_by → · part_of →",
  verify: "enabled · depth: standard",
};

export const DEMO_CONNECTIONS = [
  { name: "OpenAI production", type: "openai", masked: "sk-…4kRv", status: "active", verified: "verified" },
  { name: "Anthropic default", type: "anthropic", masked: "sk-…9mQz", status: "active", verified: "verified" },
] as const;

/** Provider picker options — matches integrations UI (direct providers). */
export const DEMO_PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "mistral", label: "Mistral" },
  { value: "google", label: "Google" },
] as const;

export const DEMO_ADDING_PROVIDER = "mistral";

export const DEMO_ROUTE_STEPS = [
  {
    id: "demo-route-step-1",
    orderIndex: 0,
    label: "Primary",
    modelId: "gpt-4o-mini",
    providerPreference: "openai",
    enabled: true,
  },
  {
    id: "demo-route-step-2",
    orderIndex: 1,
    label: null,
    modelId: "claude-3-5-sonnet",
    providerPreference: "anthropic",
    enabled: true,
  },
] as const;

export const DEMO_ROUTE_STEP_LINKS = [
  {
    id: "demo-route-link-1",
    fromStepId: "demo-route-step-1",
    toStepId: "demo-route-step-2",
    priority: 0,
    label: "on error",
  },
];

export const DEMO_GRAPH_UNITS = [
  {
    text: "Gutenberg completed his press between 1440–1450",
    status: "ok" as const,
    sources: 3,
  },
  {
    text: "Movable type existed in China ~1040 AD (Bi Sheng)",
    status: "ok" as const,
    sources: 2,
  },
  {
    text: "Gutenberg was inspired by Korean metal type",
    status: "weak" as const,
    sources: 1,
  },
];

export const DEMO_GRAPH_STATS = {
  units: 847,
  relations: 2100,
  verifiedPct: 94,
};

/** Abbreviated MCP config for marketing demo (no real secrets). */
export const DEMO_MCP_SNIPPET = `{
  "mcpServers": {
    "restormel": {
      "command": "npx",
      "args": ["-y", "@restormel/mcp"],
      "env": {
        "RESTORMEL_CONNECT_API_BASE": "https://restormel.dev",
        "RESTORMEL_GATEWAY_KEY": "rk_…your-key",
        "RESTORMEL_WORKSPACE_ID": "…workspace-uuid"
      }
    }
  }
}`;

export const DEMO_MCP_TOOL_RESULT = `connect.search("Gutenberg press")
→ claims: 12 · relations: 8
→ context_pack: analysis / critique / synthesis
metadata.retrieval_degraded: false`;
