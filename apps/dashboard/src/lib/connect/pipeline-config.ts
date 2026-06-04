import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const CONNECT_PIPELINE_API = DASHBOARD_BASE + "/api/connect";
export const CONNECT_PIPELINE_BASE = DASHBOARD_BASE + "/connect/pipeline";

export const PIPELINE_STAGES = [
  "extracting",
  "relating",
  "grouping",
  "embedding",
  "validating",
  "remediating",
  "storing",
] as const;

export type GraphTarget = {
  id: string;
  provider: string;
  connection: { endpoint?: string; namespace?: string; database?: string; username?: string };
  use_dashboard_database?: boolean;
  secret_set: boolean;
  status: string;
  last_error?: string;
} | null;

export type DomainPack = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  is_builtin: boolean;
  ontology: {
    unit_noun: string;
    group_noun: string;
    domains: string[];
    unit_types?: string[];
    relation_types?: { name: string; description?: string }[];
    group_roles?: string[];
    schema_mode?: string;
  };
};

export type PipelineProfile = {
  id: string;
  title: string;
  domain_pack_id: string;
  default_stop_after_stage?: string;
};

export type SourceConnection = {
  id: string;
  provider: string;
  label?: string;
  status: string;
  config: Record<string, unknown>;
};

export type DocRef = { id: string; name: string; mime?: string; size?: number; uri?: string };

export type SourceDocument = {
  id: string;
  name: string;
  source_kind: string;
  mime?: string;
  char_count: number;
  chunk_count: number;
  status: string;
  error?: string;
  created_at: string;
};

/** Query param: pipeline wizard step to return to after a side task (models, integrations, route builder). */
export const WIZARD_STEP_QUERY = "wizard_step";

export const PIPELINE_WIZARD_STEPS = [
  {
    id: "store",
    label: "Graph store",
    title: "Choose where your graph lives",
    lead: "Agents need a durable home for ideas and relationships. Use your workspace database in one click, or connect SurrealDB you manage.",
    required: true,
  },
  {
    id: "domain",
    label: "Domain",
    title: "Define how documents become a graph",
    lead: "Use a built-in pack, import an existing SurrealDB schema, design with AI, or create a custom pack. Each pack can target different Surreal tables for ingest.",
    required: false,
  },
  {
    id: "sources",
    label: "Sources",
    title: "Connect where documents live",
    lead: "Import from any mix of URLs, uploads, connectors, or crawls. Check the documents to include in your next run — you can change the selection between runs.",
    required: false,
  },
  {
    id: "ready",
    label: "Review",
    title: "Review your pipeline",
    lead: "Confirm the graph store, domain pack, and documents you configured. When you're happy, name and start your run.",
    required: false,
  },
  {
    id: "run",
    label: "Run",
    title: "Name your run",
    lead: "Give this ingest run a label so you can find it later. Your pipeline settings from the previous steps apply automatically.",
    required: false,
  },
] as const;

export type PipelineWizardStepId = (typeof PIPELINE_WIZARD_STEPS)[number]["id"];

export type PipelineWizardProgress = {
  hasGraphStore: boolean;
  graphStoreLabel: string | null;
  hasCustomPack: boolean;
  packTitle: string | null;
  selectedDomainPackId: string | null;
  connectionCount: number;
  parsedDocumentCount: number;
  selectedDocumentCount: number;
};

export type PipelineRunPackOption = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  is_builtin: boolean;
};

export type PipelineRunDefaults = {
  graphTargetId: string | null;
  domainPackId: string | null;
  pipelineProfileId: string | null;
  packTitle: string | null;
  graphStoreLabel: string | null;
  documents: { id: string; name: string; chunk_count: number }[];
  packs: PipelineRunPackOption[];
  selectedDomainPackId: string | null;
  defaultStopAfterStage: string | null;
};

export function isPipelineWizardStep(value: string | null): value is PipelineWizardStepId {
  return PIPELINE_WIZARD_STEPS.some((s) => s.id === value);
}

export function pipelineWizardHref(step: PipelineWizardStepId, extraParams?: Record<string, string>): string {
  const params = new URLSearchParams({ step, ...extraParams });
  return `${CONNECT_PIPELINE_BASE}?${params.toString()}`;
}

export function parseWizardStepParam(value: string | null): PipelineWizardStepId | null {
  return isPipelineWizardStep(value) ? value : null;
}

export function pipelineWizardStepLabel(step: PipelineWizardStepId): string {
  return PIPELINE_WIZARD_STEPS.find((s) => s.id === step)?.label ?? step;
}

/** Append wizard return context to dashboard links opened from the pipeline wizard. */
export function withWizardReturn(href: string, wizardStep: PipelineWizardStepId | null | undefined): string {
  if (!wizardStep) return href;
  const url = new URL(href, "https://restormel.local");
  url.searchParams.set(WIZARD_STEP_QUERY, wizardStep);
  return `${url.pathname}${url.search}`;
}

export function isPipelineWizardPath(pathname: string): boolean {
  return pathname === CONNECT_PIPELINE_BASE;
}
