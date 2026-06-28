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

/**
 * R4 — the guided flow's *visible* steps, in golden-path order (§1.1):
 * provider key (only when missing — K2 verify inline) → sources + pack →
 * domain (optional) → review + launch (K3 preflight). The store step is
 * DEMOTED out of this strip to an automated-with-override aside (workspace
 * Neon default auto-provisions on flow entry; "Configure store" stays reachable
 * via the launch panel, never blocking the default path — W3.6 placement). It
 * remains a *valid* step id (see `ALL_PIPELINE_WIZARD_STEP_IDS`) so the
 * `/sources/ingest/store` redirect stub, `pipelineWizardHref("store")`, and the
 * `?step=store` redirect carry keep working.
 */
export const PIPELINE_WIZARD_STEPS = [
  {
    id: "provider",
    label: "Provider key",
    title: "Add a provider key",
    lead: "Connect one AI provider — verified live on save. Ingest needs at least one chat and one embedding route to extract, group, validate, and embed your documents.",
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
    id: "domain",
    label: "Domain",
    title: "Define how documents become a graph",
    lead: "Use a built-in pack, import an existing SurrealDB schema, design with AI, or create a custom pack. Each pack can target different Surreal tables for ingest.",
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

/**
 * The demoted store step — a valid step id but never shown in the stepper strip.
 * Reachable via "Configure store" on the launch panel and the redirect stubs.
 */
export const DEMOTED_PIPELINE_WIZARD_STEP = {
  id: "store",
  label: "Graph store",
  title: "Choose where your graph lives",
  // R4-S2(c): this lead must be true with the `connectHostManagedGraphStore` flag OFF
  // (MVP default), where the store is BYO and nothing is auto-provisioned. The
  // "provisioned automatically" claim is added by the wizard ONLY when the flag is
  // ON (see `storeLead` in ConnectPipelineWizard). Keep this copy flag-neutral.
  lead: "Agents need a durable home for ideas and relationships. Connect the host-managed Postgres graph store or a SurrealDB you manage, and opt into the claim-versions table if you need point-in-time history.",
  required: false,
} as const;

/** Legacy wizard step ids — redirect to `launch`. */
export const LEGACY_PIPELINE_WIZARD_STEP_IDS = ["ready", "run"] as const;

/** Every valid step id (visible flow steps + the demoted store step). */
export const ALL_PIPELINE_WIZARD_STEP_IDS = [
  ...PIPELINE_WIZARD_STEPS.map((s) => s.id),
  DEMOTED_PIPELINE_WIZARD_STEP.id,
] as const;

export type PipelineWizardStepId =
  | (typeof PIPELINE_WIZARD_STEPS)[number]["id"]
  | (typeof DEMOTED_PIPELINE_WIZARD_STEP)["id"];

export type PipelineWizardProgress = {
  hasGraphStore: boolean;
  graphStoreLabel: string | null;
  /** R4: at least one provider integration exists (gates whether the provider step shows). */
  hasProviderKey: boolean;
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
  return ALL_PIPELINE_WIZARD_STEP_IDS.some((id) => id === value);
}

export function pipelineWizardHref(step: PipelineWizardStepId, extraParams?: Record<string, string>): string {
  const params = new URLSearchParams({ step, ...extraParams });
  return `${CONNECT_PIPELINE_BASE}?${params.toString()}`;
}

export function parseWizardStepParam(value: string | null): PipelineWizardStepId | null {
  return isPipelineWizardStep(value) ? value : null;
}

/**
 * R4-U1: the wizard's forward traversal (what "Continue" does). Positional over the
 * visible strip, EXCEPT `domain` is auto-skipped when a pack is already satisfied
 * (`selectedDomainPackId || hasCustomPack`) — so a provisioned workspace entering at
 * `sources` reaches `launch` in one Continue (sources+pack → launch = 2 panels), not
 * two. `domain` stays reachable via the stepper and the launch panel's "Edit →".
 * Returns null when `fromStep` is the last step or not a visible step.
 */
export function nextPipelineWizardStep(
  fromStep: PipelineWizardStepId,
  packSatisfied: boolean,
): PipelineWizardStepId | null {
  const fromIdx = PIPELINE_WIZARD_STEPS.findIndex((s) => s.id === fromStep);
  if (fromIdx < 0 || fromIdx >= PIPELINE_WIZARD_STEPS.length - 1) return null;
  let nextIdx = fromIdx + 1;
  if (PIPELINE_WIZARD_STEPS[nextIdx]?.id === "domain" && packSatisfied) {
    nextIdx += 1;
  }
  return PIPELINE_WIZARD_STEPS[nextIdx]?.id ?? null;
}

export function pipelineWizardStepLabel(step: PipelineWizardStepId): string {
  if (step === DEMOTED_PIPELINE_WIZARD_STEP.id) return DEMOTED_PIPELINE_WIZARD_STEP.label;
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

// ── RES-113 · M1 "Build" friendly reskin model (PR-C) ────────────────────────
// Additive + purely presentational. Every export below is consumed ONLY behind
// the `onboardingJourney` module flag (default OFF). With the flag OFF these are
// dead code: the live Provider→Sources→Domain→Review wizard and the seven-stage
// run console render byte-for-byte unchanged. This is a RESKIN over the real
// components, never a re-route — the underlying wizard steps and pipeline stages
// are untouched. Grounding: REC-ADR-013 (M0–M4 ladder), REC-ADR-015 (model
// choice happens at ingest, never retroactively), REC-ADR-016 (honest pipeline
// states — name the real state, never fake progress).

/** The friendly four-rung M1 grouping (03_SCREENS §M1: Sources · Configure · Ingest · Ask). */
export type M1BuildRungId = "sources" | "configure" | "running" | "done";

export type M1BuildRung = {
  id: M1BuildRungId;
  /** Stepper chip text. */
  label: string;
  /** Friendly screen title. */
  title: string;
  /** One-line friendly lead. */
  lead: string;
};

export const M1_BUILD_RUNGS: readonly M1BuildRung[] = [
  {
    id: "sources",
    label: "Sources",
    title: "Add your sources",
    lead: "Point us at where your documents live — uploads, URLs, connectors, or a crawl.",
  },
  {
    id: "configure",
    label: "Configure",
    title: "Choose models",
    lead: "Recommended models are picked for you. Models are chosen here, at ingest — never retroactively.",
  },
  {
    id: "running",
    label: "Running",
    title: "Building your graph",
    lead: "Reading your documents and turning them into a connected, citable graph. This can take a few minutes.",
  },
  {
    id: "done",
    label: "Done",
    title: "Ask your own data",
    lead: "Your graph is ready. Ask a question and get a grounded answer with citations — from your sources.",
  },
] as const;

/**
 * Map each live wizard step → its friendly M1 rung. Provider key, domain pack,
 * and the demoted store aside all FOLD INTO "Configure" (one friendly decision
 * point); the launch/review panel is the final Configure sub-state before the
 * run starts. "Running" and "Done" are owned by the run console, not the wizard.
 *
 * Note: the live wizard orders provider→sources→domain→launch, while the
 * friendly ladder reads Sources→Configure. Rung state is therefore derived from
 * real completion signals (not live step position) so the friendly stepper never
 * shows a step backwards — see `m1CompletedRungsFromSteps`.
 */
export const M1_WIZARD_STEP_TO_RUNG: Record<PipelineWizardStepId, M1BuildRungId> = {
  provider: "configure",
  sources: "sources",
  domain: "configure",
  store: "configure",
  launch: "configure",
};

export function m1RungForWizardStep(step: PipelineWizardStepId): M1BuildRungId {
  return M1_WIZARD_STEP_TO_RUNG[step] ?? "sources";
}

export function m1BuildRung(id: M1BuildRungId): M1BuildRung {
  return M1_BUILD_RUNGS.find((r) => r.id === id) ?? M1_BUILD_RUNGS[0];
}

export type M1RungVisualState = "completed" | "active" | "upcoming";

/**
 * The friendly rungs that are genuinely complete, derived from the wizard's own
 * per-step completion signals (REC-ADR-016: real state, not position). "Sources"
 * is done once a document is selected; "Configure" once a domain pack or provider
 * key is in place. Running/Done are never complete inside the wizard.
 */
export function m1CompletedRungsFromSteps(completedStepIds: readonly PipelineWizardStepId[]): M1BuildRungId[] {
  const out: M1BuildRungId[] = [];
  if (completedStepIds.includes("sources")) out.push("sources");
  if (completedStepIds.includes("domain") || completedStepIds.includes("provider")) out.push("configure");
  return out;
}

export function m1RungVisualState(
  rung: M1BuildRungId,
  ctx: { activeRung: M1BuildRungId; completedRungs: readonly M1BuildRungId[] },
): M1RungVisualState {
  if (rung === ctx.activeRung) return "active";
  if (ctx.completedRungs.includes(rung)) return "completed";
  return "upcoming";
}

/**
 * The friendly active/completed rungs FOR THE RUN CONSOLE. By the time a run is
 * executing, Sources + Configure are behind the user; "Running" is active until
 * the job completes, then "Done" (ask your data) takes over. Honest: nothing is
 * marked done until the run actually completes (REC-ADR-016).
 */
export function m1RunConsoleRungs(input: {
  isCompleted: boolean;
}): { activeRung: M1BuildRungId; completedRungs: M1BuildRungId[] } {
  const completedRungs: M1BuildRungId[] = ["sources", "configure"];
  if (input.isCompleted) {
    completedRungs.push("running");
    return { activeRung: "done", completedRungs };
  }
  return { activeRung: "running", completedRungs };
}

/**
 * Friendly, plain-language relabels for the seven technical pipeline stages,
 * shown in the run console's friendly view. The real `PIPELINE_STAGES` keys are
 * unchanged — this is a display map only.
 */
export const M1_FRIENDLY_STAGE_LABELS: Record<(typeof PIPELINE_STAGES)[number], string> = {
  extracting: "Reading your documents",
  relating: "Connecting the ideas",
  grouping: "Organising into topics",
  embedding: "Making it searchable",
  validating: "Checking the claims",
  remediating: "Fixing weak spots",
  storing: "Saving to your graph",
};

export function m1FriendlyStageLabel(stageKey: string): string {
  return (M1_FRIENDLY_STAGE_LABELS as Record<string, string>)[stageKey] ?? stageKey;
}

/** Front-half stages (build the graph) — shown up front in the friendly run view. */
export const M1_RUN_FRONT_STAGES = ["extracting", "relating", "grouping", "embedding"] as const;
/** Back-half stages (check & store) — the detail tucked under the "what's happening" expander. */
export const M1_RUN_BACK_STAGES = ["validating", "remediating", "storing"] as const;

/**
 * Presentational rate-limit banner copy (03_SCREENS §M1 edge states). Shown as an
 * AMBER, no-action-needed state — the run keeps itself moving. The real backoff
 * signal is wired in PR-I; until then this banner only renders if a stage reports
 * a rate-limited status, so it never fabricates a state that isn't happening.
 */
export const M1_RATE_LIMIT_BANNER = {
  title: "Provider rate-limited",
  body: "Backing off and retrying automatically — no action needed. Your run resumes on its own.",
} as const;

/** Stage statuses an ingest engine may emit to signal a transient rate-limit / backoff. */
const M1_RATE_LIMITED_STAGE_STATUSES = new Set(["rate_limited", "rate-limited", "backoff", "throttled"]);

export function isM1RateLimitedStatus(status: string | null | undefined): boolean {
  return status != null && M1_RATE_LIMITED_STAGE_STATUSES.has(status);
}
