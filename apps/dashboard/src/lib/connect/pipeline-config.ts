import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { CLAIMS_HREF, INGEST_FLOW_HREF, INGEST_ROUTES_HREF } from "$lib/nav-config";
import { journeyStageName } from "$lib/connect/stage-vocabulary";

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
    /**
     * RES-113 verification-engine plug-points (PR-1): per-slot component choice,
     * keyed by {@link PipelineSlotId} → curated option id. Absent/empty ⇒ the
     * recommended default for every slot (a "default bundle"). Persisted through
     * the existing `updateConnectGraphTargetBundle` settings shallow-merge — this
     * is a settings key, not a schema column, so no migration lands with PR-1.
     */
    pipeline_slots?: Partial<Record<PipelineSlotId, string>>;
    /**
     * RES-113 (PR-5 render): slots whose curated choice was withdrawn server-side
     * and reverted to the recommended default (D-2026-07-02-1 rollback). Drives
     * the one-time §6.2 revert notice; the withdrawn option is absent from menus.
     */
    reverted_slots?: PipelineSlotId[];
    /**
     * RES-113 (PR-3): the deployment preset last applied to this graph
     * (`PipelinePresetId`). Drives the copy-pack §2.7 "Part of {preset}." slot
     * annotation — a marker only, the real per-slot choices live in
     * `pipeline_slots`. Absent ⇒ no preset applied (fresh default or hand-picked).
     */
    pipeline_preset?: string;
    /**
     * RES-113 (PR-5): per-slot display name of the option withdrawn server-side
     * (D-2026-07-02-1 rollback). Present ⇒ that slot reverted to the recommended
     * default; the derivation renders the one §2.7 withdrawal notice with this
     * {name} and drops the option from the slot's menu. Stored as the display name
     * (self-contained — survives the option leaving the CLEARED catalog).
     */
    withdrawn_slots?: Partial<Record<PipelineSlotId, string>>;
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

// ── RES-113 · verification-engine plug-points — slot derivation (PR-1) ──────────
// Pure TS. Consumed ONLY behind the `m1PlugPoints` render flag (added by PR-2, the
// first rendering PR); nothing imports these exports yet, so the default path stays
// byte-for-byte identical (flag-OFF invariant). Grounding: the signed-off placement
// spec (restormel-ops planning/verification-ui-placement-spec.md — §3.1, §3.3,
// §3.4 decisions B/C/D/F, §5 PR-1), the copy pack docs/design/res113-copy-pack.md
// §2.7 (every user string VERBATIM), REC-GOV-022 (the authoritative CLEARED set —
// BLOCKED/AMBIGUOUS components never appear in output), REC-ADR-023 invariant 1
// (the checker is always a different maker family from the extractor).
//
// Two hosts, ONE derivation (decision C): this module is the single source for both
// the sources-page "Advanced" disclosure and its `/routes/ingestion` twin. It does
// NOT duplicate `ConnectGraphLibrary.svelte` — see the PR-2 reconciliation contract
// at the foot of this section.

/** The three plug-point slots. Store is NEVER a slot — the `?step=store` aside owns it. */
export type PipelineSlotId = "extract" | "embed" | "validate";

export const PIPELINE_SLOT_IDS = ["extract", "embed", "validate"] as const;

/**
 * Slot → the REAL engine stage key (`PIPELINE_STAGES`) whose §0 on-screen name the
 * row reuses. The name comes from `journeyStageName` (stage-vocabulary.ts) — never
 * re-authored here, so the two surfaces can never drift (extend-never-duplicate).
 */
const SLOT_STAGE_KEY: Record<PipelineSlotId, string> = {
  extract: "extracting",
  embed: "embedding",
  validate: "validating",
};

/**
 * Maker "family" for cross-family independence (REC-ADR-023 invariant 1: the checker
 * is always a different family from the extractor). Used only to exclude options that
 * would put the extract and validate slots on the same maker — an excluded option is
 * ABSENT from the offered list (decision B: absent-with-reason, never disabled-and-
 * teasing), and its absence lights the one reason line. NOT user-facing.
 */
export type ComponentFamily =
  | "paddle"
  | "mistral"
  | "baai"
  | "qwen"
  | "voyage"
  | "ibm"
  | "vectara"
  | "frontier";

/** One curated, CLEARED option. Display name + outcome line are copy-pack §2.7 VERBATIM. */
export type CuratedOption = {
  /** Stable neutral id (never a vendor SDK type; safe in cache keys / persisted bundle). */
  id: string;
  /** On-screen name — copy pack §2.7, verbatim. */
  name: string;
  /** Outcome line — copy pack §2.7, verbatim. Trade-off named as an outcome, never a licence/tier/cost. */
  outcome: string;
  /** Maker family, for the cross-family independence check only. */
  family: ComponentFamily;
  /** True for the one recommended default per slot (rendered first; `RECOMMENDED` tag). */
  isRecommended?: true;
};

/**
 * The curated menus — CLEARED components ONLY (REC-GOV-022 §d). This catalog is the
 * single choke point that makes "BLOCKED/AMBIGUOUS names never appear in output" a
 * structural guarantee, not a runtime filter: the REC-GOV-022 BLOCKED and AMBIGUOUS
 * sets are simply absent — there is no code path that could surface them. (Those
 * component names are deliberately NOT spelled here: the licensing gate greps this
 * tree binary, and the exclusion rationale lives in REC-GOV-022 / the placement spec.)
 *
 * Order is significant: the recommended default is first (copy pack §2.7 list order).
 * A menu change is a change to REC-GOV-022 first, then the copy pack §2.7 table, then here.
 */
const SLOT_CATALOG: Record<PipelineSlotId, readonly CuratedOption[]> = {
  extract: [
    {
      id: "paddleocr-vl",
      name: "PaddleOCR-VL",
      outcome:
        "The recommended reader. Handles most documents well and keeps the exact position of every fact, so citations can highlight the source passage.",
      family: "paddle",
      isRecommended: true,
    },
    {
      id: "mistral-ocr-4",
      name: "Mistral OCR 4",
      outcome:
        "The most accurate on difficult documents — scanned pages, dense tables, many languages. Runs as a hosted service, so your pages leave your infrastructure.",
      family: "mistral",
    },
    {
      id: "paddleocr-ppocrv5",
      name: "PaddleOCR PP-OCRv5",
      outcome:
        "The fastest on plain, cleanly laid-out pages — a good fit for large volumes of simple documents. Less accurate on difficult ones.",
      family: "paddle",
    },
  ],
  embed: [
    {
      id: "bge-m3",
      name: "BGE-M3",
      outcome:
        "The recommended choice. Strong search across many languages, and it can run entirely on your own infrastructure.",
      family: "baai",
      isRecommended: true,
    },
    {
      id: "qwen3-embedding-8b",
      name: "Qwen3-Embedding-8B",
      outcome:
        "The strongest search quality — the pick when questions keep missing facts you know are there. Needs more computing power, so builds take longer.",
      family: "qwen",
    },
    {
      id: "voyage-4-lite",
      name: "voyage-4-lite",
      outcome:
        "A hosted option with nothing to run yourself. Light and quick; search quality sits a step below the recommended choice.",
      family: "voyage",
    },
    {
      id: "voyage-domain-models",
      name: "Voyage domain models (legal · finance · code)",
      outcome:
        "Tuned for legal, financial, or code documents — stronger search in those fields. Hosted, so your text leaves your infrastructure.",
      family: "voyage",
    },
  ],
  validate: [
    {
      id: "granite-guardian",
      name: "Granite Guardian",
      outcome:
        "The recommended check. Clear cases pass quickly, unclear ones get a stronger look, and anything still uncertain waits for your verdict.",
      family: "ibm",
      isRecommended: true,
    },
    {
      id: "frontier-hosted",
      name: "Frontier hosted model (Claude, Gemini, or GPT)",
      outcome:
        "The most thorough check for high-stakes work — a model from a different maker re-checks each fact. The slowest option, and facts go to that provider.",
      family: "frontier",
    },
    {
      id: "hhem-2.1-open",
      name: "HHEM-2.1-Open",
      outcome:
        "The lightest check — fast, and it runs on your own infrastructure. It settles fewer cases on its own, so more facts wait for your verdict.",
      family: "vectara",
    },
  ],
};

/**
 * The single incompatibility reason line — copy pack §2.7, VERBATIM (decisions B + D).
 * Stage-table language; the word "checker" never appears. Rendered ONCE, as a muted
 * line in the affected slot row, only when the current selections exclude at least one
 * cleared option from that slot's list.
 */
export const PIPELINE_SLOT_INCOMPATIBILITY_REASON =
  "Some options aren't offered with your current choices. The stage that checks against sources always uses a different maker from the stage that reads your documents, so the check stays independent." as const;

/**
 * The single converged withdrawal / rollback notice — copy pack §2.7, VERBATIM
 * (decision F). `{name}` = the withdrawn option's display name; `{stage}` = the §0
 * stage-table on-screen name. Never licence or counsel language (D-2026-07-02-1);
 * the word "checker" never appears (decision D). Rendered once, `role="status"`, in
 * the affected slot row when `reverted === true`.
 */
export function pipelineWithdrawalNotice(stageName: string, withdrawnName: string): string {
  return `${withdrawnName} is no longer available — ${stageName} is back on the recommended default. Your graph and answers are unaffected.`;
}

/** The recommended default option id for a slot (the first, `isRecommended` entry). */
export function recommendedSlotOptionId(slot: PipelineSlotId): string {
  const rec = SLOT_CATALOG[slot].find((o) => o.isRecommended) ?? SLOT_CATALOG[slot][0];
  return rec.id;
}

/** One curated option as derived for a host to render. */
export type PipelineSlotOption = {
  id: string;
  /** Copy pack §2.7 display name, verbatim. */
  name: string;
  /** Copy pack §2.7 outcome line, verbatim. */
  outcome: string;
  /** True for the recommended default (rendered first, `RECOMMENDED` tag). */
  isRecommended: boolean;
  /** True when this is the slot's current choice (drives the "■ selected" mark). */
  isSelected: boolean;
};

/** One derived slot row — the unit both hosts render. No vendor/family fields leak here. */
export type PipelineSlotRow = {
  slot: PipelineSlotId;
  /** §0 on-screen stage name (from `journeyStageName`), verbatim — never re-authored. */
  stageName: string;
  /** The current choice's display name. */
  currentName: string;
  /** True when the current choice is the recommended default (⇒ no receipt, no "changed"). */
  isDefault: boolean;
  /** CLEARED options offered for this slot, recommended first, incompatible ones excluded. */
  options: PipelineSlotOption[];
  /** Present only when ≥1 cleared option was excluded for cross-family independence. */
  blockedReason?: string;
  /** Present (true) only when this slot was reverted server-side (PR-5 revert notice). */
  reverted?: true;
  /**
   * RES-113 PR-5: the display name of the option withdrawn from this slot
   * (D-2026-07-02-1 rollback). Present ⇒ `reverted` is also true; the renderer
   * fills the {name} slot of the single §2.7 withdrawal notice, and the option is
   * already absent from `options`.
   */
  withdrawnName?: string;
  /**
   * RES-113 PR-3: the display name of the applied deployment preset, present ONLY
   * while this slot's current choice matches the preset's assignment for the slot
   * (copy pack §2.7 "Part of {preset}." — "only while the current choice comes from
   * an applied preset"). Absent on a slot the operator has since customised away.
   */
  partOfPreset?: string;
};

/** Which slots resolve, in order, when reading a bundle. */
function currentOptionId(bundle: GraphTargetBundle, slot: PipelineSlotId): string {
  const chosen = bundle?.pipeline_slots?.[slot];
  if (chosen && SLOT_CATALOG[slot].some((o) => o.id === chosen)) return chosen;
  return recommendedSlotOptionId(slot);
}

/**
 * The bundle shape the slot derivation reads (the non-null branch of `GraphTarget`).
 * Exported for the PR-2 renderer + hosts (the contracts `ConnectGraphTarget["bundle"]`
 * is structurally assignable to it).
 */
export type GraphTargetBundle = NonNullable<NonNullable<GraphTarget>["bundle"]> | undefined;

/** Type guard for a plug-point slot id (PR-2: settings parsing + API validation). */
export function isPipelineSlotId(value: unknown): value is PipelineSlotId {
  return PIPELINE_SLOT_IDS.some((id) => id === value);
}

/**
 * Parse a persisted `pipeline_slots` settings value (untyped JSONB) into the
 * typed slot→option-id map. Unknown slot keys and non-string values are dropped;
 * option ids are NOT validated here (the derivation falls back to the recommended
 * default for an id it doesn't recognise, so a stale id can never render).
 * Shared by the server bundle mapping and the pipeline-slots API (PR-2).
 */
export function parsePipelineSlotAssignments(value: unknown): Partial<Record<PipelineSlotId, string>> {
  const out: Partial<Record<PipelineSlotId, string>> = {};
  if (value == null || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    if (isPipelineSlotId(k) && typeof v === "string" && v) out[k] = v;
  }
  return out;
}

/** Parse a persisted `reverted_slots` settings value into valid slot ids (PR-2). */
export function parseRevertedSlots(value: unknown): PipelineSlotId[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPipelineSlotId);
}

/**
 * Parse a persisted `withdrawn_slots` settings value (slot → withdrawn option
 * display name) into the typed map (PR-5). Unknown slot keys and non-string /
 * empty values are dropped. The stored value is a display name, not an id — it is
 * self-contained so the §2.7 withdrawal notice renders even after the option has
 * left the CLEARED catalog.
 */
export function parseWithdrawnSlots(value: unknown): Partial<Record<PipelineSlotId, string>> {
  const out: Partial<Record<PipelineSlotId, string>> = {};
  if (value == null || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    if (isPipelineSlotId(k) && typeof v === "string" && v) out[k] = v;
  }
  return out;
}

// ── RES-113 · deployment presets (PR-3, placement spec §5 item 4, decision A) ────
// One writable preset surface: `/routes/ingestion`, where the four-way choice
// EXTENDS the shipped "Reset to recommended" bulk action (not a second control).
// A preset is a whole-bundle swap: it rewrites `pipeline_slots` (via the existing
// `updateConnectGraphTargetBundle` path) and records `pipeline_preset` so the slot
// rows can annotate "Part of {preset}." (copy pack §2.7). The bundles below are the
// authoritative REC-GOV-022 §(e) "Deployment / Sovereignty Presets" table, mapped
// to the three CLEARED slot menus — every preset keeps invariant 1 (extract family
// ≠ validate family, cross-checked in the derivation test).

/** The four deployment presets — ids are neutral, names are copy pack §2.7 verbatim. */
export type PipelinePresetId =
  | "fully-managed"
  | "highest-accuracy"
  | "regional-residency"
  | "self-host-air-gapped";

export const PIPELINE_PRESET_IDS = [
  "fully-managed",
  "highest-accuracy",
  "regional-residency",
  "self-host-air-gapped",
] as const;

export type PipelinePreset = {
  id: PipelinePresetId;
  /** On-screen name — copy pack §2.7 deployment-preset options, VERBATIM. Also the {preset} slot. */
  name: string;
  /** The complete per-slot target (every slot named, defaults included) this preset selects. */
  slots: Record<PipelineSlotId, string>;
};

/**
 * REC-GOV-022 §(e) bundles, mapped to CLEARED slot option ids:
 *  - fully-managed  = the recommended default per slot (⇒ a "default bundle").
 *  - highest-accuracy = the strongest option per slot (report-b "Highest-accuracy").
 *  - regional-residency = Mistral OCR (EU residency) + open-weight embed/check on
 *    in-region compute (report-b "Regional-residency").
 *  - self-host-air-gapped = all open-weight, own-infrastructure options (report-b
 *    "Self-host / air-gapped": PaddleOCR-VL + BGE-M3 + HHEM-2.1-Open).
 * A preset change is a change to REC-GOV-022 §(e) first, then the copy pack §2.7
 * outcome lines, then here.
 */
export const PIPELINE_PRESETS: Record<PipelinePresetId, PipelinePreset> = {
  "fully-managed": {
    id: "fully-managed",
    name: "Fully managed (recommended)",
    slots: { extract: "paddleocr-vl", embed: "bge-m3", validate: "granite-guardian" },
  },
  "highest-accuracy": {
    id: "highest-accuracy",
    name: "Highest accuracy",
    slots: { extract: "mistral-ocr-4", embed: "qwen3-embedding-8b", validate: "frontier-hosted" },
  },
  "regional-residency": {
    id: "regional-residency",
    name: "Regional residency",
    slots: { extract: "mistral-ocr-4", embed: "bge-m3", validate: "granite-guardian" },
  },
  "self-host-air-gapped": {
    id: "self-host-air-gapped",
    name: "Self-host air-gapped",
    slots: { extract: "paddleocr-vl", embed: "bge-m3", validate: "hhem-2.1-open" },
  },
};

export function isPipelinePresetId(value: unknown): value is PipelinePresetId {
  return typeof value === "string" && PIPELINE_PRESET_IDS.some((id) => id === value);
}

/** The applied preset's display name for a bundle, or null when none is applied. */
export function appliedPresetName(bundle: GraphTargetBundle): string | null {
  const id = bundle?.pipeline_preset;
  return isPipelinePresetId(id) ? PIPELINE_PRESETS[id].name : null;
}

/** Parse a persisted `pipeline_preset` settings value into a valid preset id, or null. */
export function parsePipelinePreset(value: unknown): PipelinePresetId | null {
  return isPipelinePresetId(value) ? value : null;
}

/**
 * The `pipeline_slots` write-map a preset persists: the preset's target per slot,
 * with slots that already sit on their recommended default OMITTED — so applying
 * "Fully managed (recommended)" writes an empty map (a real default bundle), exactly
 * as the shipped reset leaves it. Empty ⇒ the caller clears `pipeline_slots`.
 */
export function presetSlotAssignments(presetId: PipelinePresetId): Partial<Record<PipelineSlotId, string>> {
  const preset = PIPELINE_PRESETS[presetId];
  const out: Partial<Record<PipelineSlotId, string>> = {};
  for (const slot of PIPELINE_SLOT_IDS) {
    if (preset.slots[slot] !== recommendedSlotOptionId(slot)) out[slot] = preset.slots[slot];
  }
  return out;
}

/**
 * How many stages a preset would change from a bundle's CURRENT choices — the {n}
 * in the copy pack §2.7 confirm ("This swaps {n} stages to that setup."). Compares
 * every slot's current option against the preset's full target.
 */
export function presetSlotChangeCount(bundle: GraphTargetBundle, presetId: PipelinePresetId): number {
  const preset = PIPELINE_PRESETS[presetId];
  return PIPELINE_SLOT_IDS.filter((slot) => currentOptionId(bundle, slot) !== preset.slots[slot]).length;
}

/**
 * Cross-family independence filter (REC-ADR-023 invariant 1), extracted as a pure,
 * exported-for-test seam. Given a slot's full CLEARED menu, the current choice id, and
 * the family the *paired* slot currently sits on (or null when the slot is unpaired),
 * returns the offered menu with any option that shares the paired family EXCLUDED —
 * except the current choice itself is always kept so a row can always show what it runs.
 *
 * NOTE on the shipped catalog: `extract` families ({paddle, mistral}) and `validate`
 * families ({ibm, frontier, vectara}) are disjoint by construction, so no exclusion
 * fires with today's CLEARED menus (the invariant holds for free). This helper is the
 * enforcement seam that keeps it holding when REC-GOV-022 later admits an option that
 * would collide — and it is unit-tested directly against a crafted collision so the
 * exclusion + reason-line mechanism is genuinely covered, not merely asserted.
 */
export function offeredOptionsForFamilyConflict(
  full: readonly CuratedOption[],
  currentId: string,
  pairedFamily: ComponentFamily | null,
): { offered: CuratedOption[]; excludedAny: boolean } {
  if (pairedFamily == null) return { offered: [...full], excludedAny: false };
  const offered = full.filter((o) => o.family !== pairedFamily || o.id === currentId);
  return { offered, excludedAny: offered.length < full.length };
}

/**
 * Derive the plug-point slot rows for a graph's bundle. Pure function of the bundle.
 *
 * Cross-family independence (REC-ADR-023 invariant 1) is enforced via
 * {@link offeredOptionsForFamilyConflict}: an option for the `validate` slot is
 * EXCLUDED when it shares a maker family with the current `extract` choice (and
 * vice-versa). Excluded options are absent from `options` (decision B — never
 * disabled-and-teasing); their absence sets `blockedReason` to the single §2.7 line.
 * BLOCKED/AMBIGUOUS components can never appear because they are absent from
 * `SLOT_CATALOG` — this function only ever filters the CLEARED set.
 */
export function resolveM1PipelineSlots(bundle: GraphTargetBundle): PipelineSlotRow[] {
  const currentByFamily: Record<PipelineSlotId, ComponentFamily> = {
    extract: familyOf("extract", currentOptionId(bundle, "extract")),
    embed: familyOf("embed", currentOptionId(bundle, "embed")),
    validate: familyOf("validate", currentOptionId(bundle, "validate")),
  };
  const revertedSet = new Set(bundle?.reverted_slots ?? []);
  // PR-5: slots whose curated choice was withdrawn server-side (slot → withdrawn
  // display name). Drives the one §2.7 withdrawal notice + the menu exclusion.
  const withdrawn = bundle?.withdrawn_slots ?? {};
  // PR-3: the applied preset, for the per-slot "Part of {preset}." annotation.
  const presetId = isPipelinePresetId(bundle?.pipeline_preset) ? bundle?.pipeline_preset : null;
  const preset = presetId ? PIPELINE_PRESETS[presetId] : null;

  return PIPELINE_SLOT_IDS.map((slot): PipelineSlotRow => {
    const currentId = currentOptionId(bundle, slot);
    const recId = recommendedSlotOptionId(slot);

    // The family the OTHER paired slot currently sits on, for the independence check.
    // extract⇄validate are the paired stages the invariant names; embed is unconstrained.
    const pairedFamily =
      slot === "validate"
        ? currentByFamily.extract
        : slot === "extract"
          ? currentByFamily.validate
          : null;

    const { offered, excludedAny } = offeredOptionsForFamilyConflict(
      SLOT_CATALOG[slot],
      currentId,
      pairedFamily,
    );

    // PR-5: a withdrawn option is absent from the menu thereafter (decisions D+F).
    const withdrawnName = withdrawn[slot];
    const menu = withdrawnName ? offered.filter((o) => o.name !== withdrawnName) : offered;

    const options: PipelineSlotOption[] = menu.map((o) => ({
      id: o.id,
      name: o.name,
      outcome: o.outcome,
      isRecommended: o.isRecommended === true,
      isSelected: o.id === currentId,
    }));

    const row: PipelineSlotRow = {
      slot,
      stageName: journeyStageName(SLOT_STAGE_KEY[slot]),
      currentName: nameOf(slot, currentId),
      isDefault: currentId === recId,
      options,
    };
    if (excludedAny) row.blockedReason = PIPELINE_SLOT_INCOMPATIBILITY_REASON;
    // PR-5: a withdrawn choice reverts server-side to default and marks the slot.
    if (revertedSet.has(slot) || withdrawnName) row.reverted = true;
    if (withdrawnName) row.withdrawnName = withdrawnName;
    // PR-3: annotate only while this slot's current choice still comes from the
    // applied preset (copy pack §2.7) — a slot customised away loses the annotation.
    if (preset && preset.slots[slot] === currentId) row.partOfPreset = preset.name;
    return row;
  });
}

/** True when the bundle runs the recommended default for every slot (a "default bundle"). */
export function isDefaultPipelineBundle(bundle: GraphTargetBundle): boolean {
  return PIPELINE_SLOT_IDS.every((slot) => currentOptionId(bundle, slot) === recommendedSlotOptionId(slot));
}

/** Count of slots changed from the recommended default — drives the §2.7 customisation summary. */
export function changedPipelineSlotCount(bundle: GraphTargetBundle): number {
  return PIPELINE_SLOT_IDS.filter((slot) => currentOptionId(bundle, slot) !== recommendedSlotOptionId(slot)).length;
}

function familyOf(slot: PipelineSlotId, optionId: string): ComponentFamily {
  const opt = SLOT_CATALOG[slot].find((o) => o.id === optionId) ?? SLOT_CATALOG[slot][0];
  return opt.family;
}

function nameOf(slot: PipelineSlotId, optionId: string): string {
  const opt = SLOT_CATALOG[slot].find((o) => o.id === optionId) ?? SLOT_CATALOG[slot][0];
  return opt.name;
}
