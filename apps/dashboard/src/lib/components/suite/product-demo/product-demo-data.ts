export type DemoStepId =
  | "keys"
  | "routes"
  | "database"
  | "graph-config"
  | "ingest"
  | "validate"
  | "agents";

export type DemoStep = {
  id: DemoStepId;
  shortLabel: string;
  headline: string;
  caption: string;
};

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "keys",
    shortLabel: "Connections",
    headline: "Connect your providers",
    caption: "BYOK — keys stay in your infra, no proxy",
  },
  {
    id: "routes",
    shortLabel: "Routes",
    headline: "Configure your resolve chain",
    caption: "Route by cost, latency, or capability — swap models without touching your app",
  },
  {
    id: "database",
    shortLabel: "Graph store",
    headline: "Choose where your graph lives",
    caption: "Your data never leaves your database",
  },
  {
    id: "graph-config",
    shortLabel: "Domain",
    headline: "Define your domain with a prompt",
    caption: "One prompt configures extraction, grouping, and validation logic",
  },
  {
    id: "ingest",
    shortLabel: "Ingest",
    headline: "Run the pipeline",
    caption: "Extract · Relate · Group · Embed · Validate · Remediate · Store",
  },
  {
    id: "validate",
    shortLabel: "Graph",
    headline: "Explore and verify the graph",
    caption: "Review ideas, flagged claims, and provenance in the explorer",
  },
  {
    id: "agents",
    shortLabel: "Agents",
    headline: "Connect your agent via MCP",
    caption: "connect.search · structured context pack · your BYO Surreal graph",
  },
];

/** Auto-advance interval for the suite landing demo (ms). */
export const DEMO_STEP_MS = 3500;

export const INGEST_LOG_LINES = [
  "[VALIDATE] 58 validation row(s)",
  "[VALIDATE] 72 claims identified",
  "[VALIDATE] 68 claims verified",
  "[REMEDIATE] Fixing 4 low-confidence nodes",
  "[REMEDIATE] Remediation complete",
  "[STORE] Persisting to graph store...",
] as const;

export const INGEST_STAGES = [
  { id: "01", name: "EXTRACT", status: "done" as const },
  { id: "02", name: "RELATE", status: "done" as const },
  { id: "03", name: "GROUP", status: "done" as const },
  { id: "04", name: "EMBED", status: "done" as const },
  { id: "05", name: "VALIDATE", status: "done" as const },
  { id: "06", name: "REMEDIATE", status: "running" as const },
  { id: "07", name: "STORE", status: "pending" as const },
];
