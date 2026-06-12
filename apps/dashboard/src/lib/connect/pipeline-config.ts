import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { CLAIMS_HREF, INGEST_FLOW_HREF, INGEST_ROUTES_HREF } from "$lib/nav-config";

export const CONNECT_PIPELINE_API = DASHBOARD_BASE + "/api/connect";
/** The ingest guided flow (the relocated setup wizard — R2: `/connect/pipeline` → `/sources/ingest`). */
export const CONNECT_PIPELINE_BASE = INGEST_FLOW_HREF;

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
  /** Stage 3.2b: per-graph bundle settings (includes allow_claim_versions_table). */
  bundle?: {
    default_domain_pack_id?: string;
    ingest_document_ids?: string[];
    default_stop_after_stage?: string;
    allow_claim_versions_table?: boolean;
  };
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

/** Ingest-routes view (R2: `/connect/models` → `/routes/ingestion`). */
export const CONNECT_MODELS_BASE = INGEST_ROUTES_HREF;
/** Claims explorer (R2: `/connect/graph` → `/claims`). */
export const CONNECT_GRAPH_BASE = CLAIMS_HREF;

/** Query param: where to return after a side task (models, integrations, route builder). */
export const RETURN_TO_QUERY = "returnTo";
/** Paired with `returnTo=pipeline-setup` — wizard step to restore. */
export const RETURN_STEP_QUERY = "step";

/** @deprecated Use RETURN_TO_QUERY — legacy alias kept for bookmark compatibility. */
export const WIZARD_STEP_QUERY = "wizard_step";

export type BuilderReturnContext =
  | { kind: "ingest-routes" }
  | { kind: "graph-auto-remediate" }
  | { kind: "graph-embed-backfill" }
  | { kind: "pipeline-setup"; step: PipelineWizardStepId };

export const PIPELINE_WIZARD_STEPS = [
  {
    id: "store",
    label: "Graph store",
    title: "Choose where your graph lives",
    lead: "Agents need a durable home for ideas and relationships. Use your workspace database in one click, or connect SurrealDB you manage — ingest runs write to one of these today. Neo4j and Weaviate settings can be saved ahead of adapter support.",
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
    id: "launch",
    label: "Review & launch",
    title: "Ready to run",
    lead: "Here's what your ingest run will process. Start when you're ready — this may take several minutes.",
    required: false,
  },
] as const;

/** Legacy wizard step ids — redirect to `launch`. */
export const LEGACY_PIPELINE_WIZARD_STEP_IDS = ["ready", "run"] as const;

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
  hasGraph: boolean;
  agentReady: boolean;
  modelsReady?: boolean;
};

export type PipelineRunPackOption = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  is_builtin: boolean;
  quality_preset?: "production" | "starter";
  cross_model_validation?: boolean;
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

export function isLegacyPipelineWizardStep(
  value: string | null,
): value is (typeof LEGACY_PIPELINE_WIZARD_STEP_IDS)[number] {
  return value === "ready" || value === "run";
}

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

export function parseReturnTo(params: URLSearchParams): BuilderReturnContext | null {
  const returnTo = params.get(RETURN_TO_QUERY);
  if (returnTo === "ingest-routes") {
    return { kind: "ingest-routes" };
  }
  if (returnTo === "graph-auto-remediate") {
    return { kind: "graph-auto-remediate" };
  }
  if (returnTo === "graph-embed-backfill") {
    return { kind: "graph-embed-backfill" };
  }
  if (returnTo === "pipeline-setup") {
    const step = params.get(RETURN_STEP_QUERY);
    if (isPipelineWizardStep(step)) {
      return { kind: "pipeline-setup", step };
    }
    return null;
  }
  /** Legacy: wizard_step without returnTo */
  const legacyStep = params.get(WIZARD_STEP_QUERY);
  if (isPipelineWizardStep(legacyStep)) {
    return { kind: "pipeline-setup", step: legacyStep };
  }
  return null;
}

export function withReturnTo(href: string, ctx: BuilderReturnContext): string {
  const url = new URL(href, "https://restormel.local");
  if (ctx.kind === "ingest-routes") {
    url.searchParams.set(RETURN_TO_QUERY, "ingest-routes");
    url.searchParams.delete(RETURN_STEP_QUERY);
    url.searchParams.delete(WIZARD_STEP_QUERY);
  } else if (ctx.kind === "graph-auto-remediate") {
    url.searchParams.set(RETURN_TO_QUERY, "graph-auto-remediate");
    url.searchParams.delete(RETURN_STEP_QUERY);
    url.searchParams.delete(WIZARD_STEP_QUERY);
  } else if (ctx.kind === "graph-embed-backfill") {
    url.searchParams.set(RETURN_TO_QUERY, "graph-embed-backfill");
    url.searchParams.delete(RETURN_STEP_QUERY);
    url.searchParams.delete(WIZARD_STEP_QUERY);
  } else {
    url.searchParams.set(RETURN_TO_QUERY, "pipeline-setup");
    url.searchParams.set(RETURN_STEP_QUERY, ctx.step);
    url.searchParams.delete(WIZARD_STEP_QUERY);
  }
  return `${url.pathname}${url.search}`;
}

export function returnContextHref(ctx: BuilderReturnContext): string {
  if (ctx.kind === "ingest-routes") {
    return CONNECT_MODELS_BASE;
  }
  if (ctx.kind === "graph-auto-remediate") {
    return `${CONNECT_GRAPH_BASE}?workspace=tools`;
  }
  if (ctx.kind === "graph-embed-backfill") {
    return `${CONNECT_GRAPH_BASE}?workspace=tools&focus=embed`;
  }
  return pipelineWizardHref(ctx.step);
}

export function returnContextBackLabel(ctx: BuilderReturnContext): string {
  if (ctx.kind === "ingest-routes") {
    return "← Back to Ingest Routes";
  }
  if (ctx.kind === "graph-auto-remediate") {
    return "← Back to auto-remediate";
  }
  if (ctx.kind === "graph-embed-backfill") {
    return "← Back to embed missing ideas";
  }
  return `← Back to pipeline setup — Step: ${pipelineWizardStepLabel(ctx.step)}`;
}

export function returnContextFromLabel(ctx: BuilderReturnContext): string {
  if (ctx.kind === "ingest-routes") {
    return "From: Ingest Routes";
  }
  if (ctx.kind === "graph-auto-remediate") {
    return "From: Graph auto-remediate";
  }
  if (ctx.kind === "graph-embed-backfill") {
    return "From: Embed missing ideas";
  }
  return "From: Pipeline setup";
}

export function isRouteBuilderPath(pathname: string): boolean {
  return /^\/keys\/dashboard\/projects\/[^/]+\/routes\/[^/]+$/.test(pathname);
}

/** @deprecated Use withReturnTo with pipeline-setup context. */
export function withWizardReturn(href: string, wizardStep: PipelineWizardStepId | null | undefined): string {
  if (!wizardStep) return href;
  return withReturnTo(href, { kind: "pipeline-setup", step: wizardStep });
}

export function isPipelineWizardPath(pathname: string): boolean {
  return pathname === CONNECT_PIPELINE_BASE;
}
