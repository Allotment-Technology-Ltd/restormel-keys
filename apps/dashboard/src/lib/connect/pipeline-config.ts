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

// ── RES-113 · M1 "Build" journey model (PR-5, supersedes the PR-C rung reskin) ──
// Every export below is consumed ONLY behind the `onboardingJourney` module flag
// (default OFF). With the flag OFF these are dead code: the live
// Provider→Sources→Domain→Review wizard and the seven-stage run console render
// byte-for-byte unchanged. Grounding: plan §3.2 (one state-derived panel — the
// interactive stepper is killed on the flag-ON path), the copy pack
// docs/design/res113-copy-pack.md §2 (strings verbatim), REC-ADR-015 (model
// choice at ingest), REC-ADR-016 (honest states — never fake progress).

/**
 * PR-5: the ONE Build panel, derived from the real signals
 * `PipelineWizardProgress` already carries. This extends the
 * `DEMOTED_PIPELINE_WIZARD_STEP` pattern: the flag-ON spine has no step strip at
 * all — a single return value is the structural guarantee that no two asks can
 * ever co-exist on screen.
 */
export type M1BuildPanelId = "provider" | "sources" | "launch";

/**
 * Provider key first (nothing can run without it), then documents, then launch.
 *
 * The sources ask keys on `selectedDocumentCount === 0`, NOT `connectionCount`:
 * `connectionCount` counts cloud CONNECTOR connections only — uploads/URLs
 * produce documents without one, and a connector with nothing imported produces
 * no documents. The wizard's own Sources completion signal (`stepDone`) and the
 * server's `resolveDefaultPipelineStep` both key on documents, and the copy
 * pack's advance rule (§2.2) is "once one source exists".
 */
export function resolveM1BuildPanel(
  p: Pick<PipelineWizardProgress, "hasProviderKey" | "selectedDocumentCount">,
): M1BuildPanelId {
  if (!p.hasProviderKey) return "provider";
  if (p.selectedDocumentCount === 0) return "sources";
  return "launch";
}

/** Copy pack §2: the four honest steps — 1 provider key · 2 documents · 3 build · 4 ask. */
export const M1_BUILD_TOTAL_STEPS = 4;

/**
 * Copy pack §2 + Appendix A-1: the non-interactive plain-language orientation
 * eyebrow renders ONLY on the two ask panels; it is suppressed on launch (and on
 * the console's running/completion states), where the CTA or tracker owns the
 * frame. Steps 3 and 4 (build, ask) exist so "of 4" stays honest even though
 * their eyebrows never render. Null = no eyebrow.
 */
export function m1BuildEyebrow(panel: M1BuildPanelId): string | null {
  if (panel === "provider") return `STEP 1 OF ${M1_BUILD_TOTAL_STEPS}`;
  if (panel === "sources") return `STEP 2 OF ${M1_BUILD_TOTAL_STEPS}`;
  return null;
}

/**
 * Copy pack §2.1–§2.3 header strings, verbatim (a string change is a change to
 * the copy pack first). The launch meta line renders the first-run "{n}
 * documents ready." variant in BOTH launch states: the re-run variant's "last
 * built {relative time} ago" segment has no honest source signal in
 * `PipelineWizardProgress`, and a missing measurement renders absent — never
 * fabricated (copy pack §0).
 */
export const M1_BUILD_PANEL_COPY = {
  provider: {
    headline: "Add an AI provider key",
    supporting:
      "Restormel uses an AI model to read your documents, and the model needs a key — a password-like code from a provider such as OpenAI or Anthropic.",
    modelsLine: "Recommended models are pre-chosen. Change them under Advanced.",
    advancedLabel: "Advanced — choose a model per stage",
  },
  sources: {
    headline: "Add your documents",
    supporting:
      "These are what your answers come from. Upload files, or connect Notion, Google Drive, or a code repository.",
  },
  launch: {
    headlineFirstRun: "Ready to build",
    headlineReRun: "Rebuild your graph",
    outcome: "Turn your documents into cited answers.",
    expectation: "Usually takes 1–3 minutes.",
    cta: "Run ingest →",
  },
} as const;

/** Copy pack §2.3 meta line: "{n} documents ready." with the §0 singular variant. */
export function m1LaunchMetaLine(documentCount: number): string {
  return documentCount === 1 ? "1 document ready." : `${documentCount} documents ready.`;
}

/**
 * Rate-limit banner copy — copy pack §2.4, verbatim. Shown as an AMBER,
 * no-action-needed state — the run keeps itself moving. As of PR-I this lights
 * from a REAL structured backoff signal threaded engine→job-record→SSE
 * (REC-ADR-016) — it never fabricates a state that isn't happening.
 */
export const M1_RATE_LIMIT_BANNER = {
  body: "The AI provider asked us to slow down. We're pausing and retrying automatically — nothing for you to do.",
} as const;

/**
 * Stage statuses an ingest engine may emit to signal a transient rate-limit / backoff.
 * Back-compat alternate signal: the canonical real wire is the structured `stage.backoff`
 * field (see {@link isM1StageBackingOff}); this status-string path is kept so an engine
 * that overloads `status` still lights the amber state.
 */
const M1_RATE_LIMITED_STAGE_STATUSES = new Set(["rate_limited", "rate-limited", "backoff", "throttled"]);

export function isM1RateLimitedStatus(status: string | null | undefined): boolean {
  return status != null && M1_RATE_LIMITED_STAGE_STATUSES.has(status);
}

/** Reason codes that earn the amber "Provider rate-limited" banner (genuine throttling). */
const M1_RATE_LIMIT_REASON_CODES = new Set(["rate_limit", "overloaded"]);

/** Minimal shape of a stage row the M1 rate-limit derivation reads (status + backoff). */
export type M1RateLimitStageRow = {
  status?: string;
  backoff?: { reason_code?: string } | null;
};

/**
 * RES-113 PR-I — true when a stage row carries a REAL structured backoff of a rate-limit
 * class (the canonical engine→SSE signal). This is what the amber banner lights from;
 * the engine only sets `backoff` while genuinely throttling and clears it on success.
 */
export function isM1StageBackingOff(row: M1RateLimitStageRow | null | undefined): boolean {
  const code = row?.backoff?.reason_code;
  return typeof code === "string" && M1_RATE_LIMIT_REASON_CODES.has(code);
}

/** True when a stage row signals a rate-limit by EITHER the structured field or a status string. */
export function isM1StageRateLimited(row: M1RateLimitStageRow | null | undefined): boolean {
  return isM1StageBackingOff(row) || isM1RateLimitedStatus(row?.status);
}
