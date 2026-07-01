/**
 * Connect hub journey — single source of truth for initial vs operational mode,
 * setup step order, and primary next actions.
 */
import {
  AGENTS_HREF,
  CLAIMS_HREF,
  RUNS_HREF,
  INGEST_ROUTES_HREF,
  INGEST_FLOW_HREF,
} from "$lib/nav-config";
import { pipelineWizardHref, withReturnTo, type PipelineWizardStepId } from "$lib/connect/pipeline-config";
import {
  buildConnectSpine,
  type ConnectSpine,
  type ConnectSpineCta,
  type ConnectSpineSignals,
  type ConnectSpineStageId,
} from "$lib/connect/connect-spine";


/** Ingest job is actively executing (not the suite-wide Monitor nav section). */
export function isActiveIngestJobStatus(status: string): boolean {
  return status === "pending" || status === "running";
}

export type ConnectJourneyPhase = "initial" | "operational";

export type ConnectJourneySignals = {
  hasGraphStore: boolean;
  modelsReady: boolean;
  parsedDocumentCount: number;
};

export type ConnectSetupStepId =
  | "graph_store"
  | "ai_keys"
  | "sources"
  | "domain_pack"
  | "run"
  | "monitor"
  | "agents";

export type ConnectSetupStep = {
  id: ConnectSetupStepId;
  title: string;
  description: string;
  status: "done" | "todo";
  detail: string;
  href: string;
  cta: string;
  optional?: boolean;
};

export type ConnectOperationalAction = {
  id: "new_run" | "view_graph" | "latest_run" | "agents" | "change_settings";
  title: string;
  description: string;
  href: string;
  cta: string;
  primary?: boolean;
};

export type ConnectGraphStatsView = {
  units: number;
  relations: number;
  groups: number;
  embedded: number;
  validation: {
    ok: number;
    weak: number;
    unsupported: number;
    unvalidated: number;
    awaiting_triage: number;
    unsupported_untriaged: number;
  };
};

/** Initial setup until store, models, and at least one parsed document exist. */
export function resolveConnectJourneyPhase(signals: ConnectJourneySignals): ConnectJourneyPhase {
  if (signals.hasGraphStore && signals.modelsReady && signals.parsedDocumentCount > 0) {
    return "operational";
  }
  return "initial";
}

export function resolveDefaultPipelineStep(params: {
  phase: ConnectJourneyPhase;
  hasGraphStore: boolean;
  parsedDocumentCount: number;
  /** R4: provider integrations present. A cold workspace sees the provider key first. */
  hasProviderKey?: boolean;
}): PipelineWizardStepId {
  // R4 (§1.1): the store step is demoted — the workspace Neon default is
  // provisioned automatically on flow entry, so it never gates the default path.
  // A cold workspace with no provider key sees the provider step first (K2 verify
  // inline); a provisioned workspace reaches launch in two panels (sources → launch).
  if (params.hasProviderKey === false) return "provider";
  if (params.phase === "operational") return "launch";
  if (params.parsedDocumentCount > 0) return "launch";
  return "sources";
}

export type BuildSetupStepsInput = {
  target: {
    provider: string;
    status: string;
  } | null;
  modelsReady: boolean;
  aiKeysDetail: string;
  customPack: { title: string } | null;
  parsedDocumentCount: number;
  starterCorpusLoaded: boolean;
  connectionCount: number;
  jobCount: number;
  latestJob: { id: string; status: string } | null;
  hasGraph: boolean;
  surrealStoreReady: boolean;
  neonStoreReady: boolean;
  /**
   * REC-ADR-008 (Stage-1): the host-managed Postgres graph store is enabled, so a missing
   * graph target is auto-provisioned on pipeline entry rather than being a required-first
   * gate. When true, the graph_store step is surfaced as "auto-provisioned (override
   * available)" and never blocks the run prerequisites.
   */
  autoProvisionAvailable?: boolean;
};

/** Canonical initial setup order: store → models → sources → domain (optional) → run → monitor → agents (optional). */
export function buildConnectSetupSteps(input: BuildSetupStepsInput): ConnectSetupStep[] {
  const {
    target,
    modelsReady,
    aiKeysDetail,
    customPack,
    parsedDocumentCount,
    starterCorpusLoaded,
    connectionCount,
    jobCount,
    latestJob,
    hasGraph,
    surrealStoreReady,
    neonStoreReady,
    autoProvisionAvailable = false,
  } = input;

  // REC-ADR-008: with the host-managed store on, a missing target is auto-provisioned on
  // pipeline entry, so for setup-step purposes the store requirement is already satisfied.
  const graphStoreSatisfied = Boolean(target) || autoProvisionAvailable;
  const prerequisitesForRun = Boolean(graphStoreSatisfied && parsedDocumentCount > 0 && modelsReady);
  const nextRequired = resolveNextSetupStepId({
    hasGraphStore: graphStoreSatisfied,
    modelsReady,
    parsedDocumentCount,
  });
  const runCtaHref = prerequisitesForRun
    ? pipelineWizardHref("launch")
    : nextRequired === "graph_store"
      ? pipelineWizardHref("store")
      : nextRequired === "ai_keys"
        ? withReturnTo(INGEST_ROUTES_HREF, { kind: "pipeline-setup", step: "sources" })
        : nextRequired === "sources"
          ? pipelineWizardHref("sources")
          : pipelineWizardHref("launch");

  return [
    {
      id: "graph_store",
      title: "Choose where your graph lives",
      description: autoProvisionAvailable
        ? "Auto-provisioned on the host-managed Postgres graph store — or connect SurrealDB you manage to override it."
        : "Use your workspace database in one click, or connect SurrealDB you manage so extracted ideas and edges have a durable graph home.",
      // With auto-provision available the store requirement is satisfied even before the
      // first target row commits, so this step is never the blocking first gate.
      status: graphStoreSatisfied ? "done" : "todo",
      detail: target
        ? target.provider === "surreal"
          ? target.status === "ok"
            ? "SurrealDB connected"
            : `SurrealDB (${target.status})`
          : "Host-managed Postgres graph store"
        : autoProvisionAvailable
          ? "Auto-provisioned (override available)"
          : "Not connected yet",
      href: pipelineWizardHref("store"),
      cta: target ? "Review store" : autoProvisionAvailable ? "Override store" : "Connect store",
    },
    {
      id: "ai_keys",
      title: "Add AI keys & configure routes",
      description:
        "Publish at least one chat route and one embedding route so ingest can extract, group, validate, and embed your documents.",
      status: modelsReady ? "done" : "todo",
      detail: aiKeysDetail,
      href: withReturnTo(INGEST_ROUTES_HREF, { kind: "pipeline-setup", step: "sources" }),
      cta: modelsReady ? "Ingest routes" : "Add keys & routes",
    },
    {
      id: "sources",
      title: "Add your documents",
      description:
        "Load the starter philosophy corpus or bring your own files, URLs, and connectors.",
      status: parsedDocumentCount > 0 ? "done" : "todo",
      detail:
        parsedDocumentCount > 0
          ? `${parsedDocumentCount} document(s) ready${starterCorpusLoaded ? " (starter corpus loaded)" : ""}${connectionCount ? `, ${connectionCount} connection(s)` : ""}`
          : "No documents added yet",
      href: pipelineWizardHref("sources"),
      cta: parsedDocumentCount > 0 ? "Add more" : "Add documents",
    },
    {
      id: "domain_pack",
      title: "Design your graph",
      description:
        "Optional: customise how the AI captures ideas and relationships. Built-in packs work for most first runs.",
      status: customPack ? "done" : "todo",
      detail: customPack ? `Using "${customPack.title}"` : "Using a built-in pack (you can customise)",
      href: pipelineWizardHref("domain"),
      cta: customPack ? "Edit design" : "Design graph",
      optional: true,
    },
    {
      id: "run",
      title: "Run ingest — turn docs into agent-ready context",
      description:
        "Start a named run using the pipeline you configured. You'll land on live progress as each stage completes.",
      status: jobCount > 0 ? "done" : "todo",
      detail: jobCount > 0 ? `${jobCount} run(s)` : "No runs yet",
      href: runCtaHref,
      cta: prerequisitesForRun ? (jobCount > 0 ? "Start another run" : "Start your run") : "Finish setup",
    },
    {
      id: "monitor",
      title: "Track ingest run",
      description:
        "While a run is in progress, watch each stage complete. After ingest, review validation in Claims.",
      status: latestJob && isActiveIngestJobStatus(latestJob.status) ? "done" : latestJob ? "done" : "todo",
      detail:
        latestJob && isActiveIngestJobStatus(latestJob.status)
          ? `In progress: ${latestJob.status}`
          : latestJob
            ? `Last run: ${latestJob.status}`
            : "No active run",
      href:
        latestJob && isActiveIngestJobStatus(latestJob.status)
          ? `${RUNS_HREF}/${latestJob.id}?from=pipeline`
          : latestJob
            ? `${RUNS_HREF}/${latestJob.id}?from=pipeline`
            : RUNS_HREF,
      cta:
        latestJob && isActiveIngestJobStatus(latestJob.status)
          ? "Watch live progress"
          : latestJob
            ? "Open last run"
            : "View runs",
    },
    {
      id: "agents",
      title: "Connect your agent",
      description: surrealStoreReady
        ? "Copy an MCP snippet so agents query your Surreal graph via Connect."
        : neonStoreReady
          ? "Use REST retrieve and your gateway key — MCP requires a Surreal graph store."
          : "Run ingest and explore the graph before wiring agents.",
      status: hasGraph && modelsReady && (surrealStoreReady || neonStoreReady) ? "done" : "todo",
      detail: hasGraph
        ? surrealStoreReady
          ? "Wire MCP tools on the Agents tab"
          : "REST retrieve available — see Agents tab"
        : "Run ingest and open Claims first",
      href: AGENTS_HREF,
      cta: hasGraph ? "Set up agents" : "Open agent setup",
      optional: true,
    },
  ];
}

export function resolveNextSetupStepId(signals: ConnectJourneySignals & { hasGraphStore: boolean }): ConnectSetupStepId | null {
  if (!signals.hasGraphStore) return "graph_store";
  if (!signals.modelsReady) return "ai_keys";
  if (signals.parsedDocumentCount <= 0) return "sources";
  return null;
}

export function resolveNextSetupStep(steps: ConnectSetupStep[]): ConnectSetupStep | null {
  const requiredOrder: ConnectSetupStepId[] = ["graph_store", "ai_keys", "sources", "run"];
  for (const id of requiredOrder) {
    const step = steps.find((s) => s.id === id);
    if (step && step.status !== "done") return step;
  }
  return null;
}

export type BuildOperationalActionsInput = {
  latestJob: { id: string; status: string; label?: string | null } | null;
  hasGraph: boolean;
  surrealStoreReady: boolean;
  modelsReady: boolean;
};

export function buildConnectOperationalActions(input: BuildOperationalActionsInput): ConnectOperationalAction[] {
  const actions: ConnectOperationalAction[] = [
    {
      id: "new_run",
      title: "New ingest run",
      description: "Start a run with your saved store, routes, domain pack, and document selection.",
      // FIX(ingest-safety): land at sources step, not launch, so the user
      // must consciously review/change their document selection before starting.
      // Jumping straight to launch let prior selections re-ingest silently.
      href: pipelineWizardHref("sources"),
      cta: "Start new run",
      primary: true,
    },
  ];

  if (input.hasGraph) {
    actions.push({
      id: "view_graph",
      title: "Explore knowledge graph",
      description: "Review extracted ideas, relationships, groups, and validation status.",
      href: CLAIMS_HREF,
      cta: "View graph",
    });
  }

  if (input.latestJob && isActiveIngestJobStatus(input.latestJob.status)) {
    actions.push({
      id: "latest_run",
      title: input.latestJob.label ? `Active run: ${input.latestJob.label}` : "Active ingest run",
      description: `Status: ${input.latestJob.status}. Watch stage-by-stage progress in the run console.`,
      href: `${RUNS_HREF}/${input.latestJob.id}?from=hub`,
      cta: "Watch live progress",
    });
  } else if (input.latestJob) {
    actions.push({
      id: "latest_run",
      title: input.latestJob.label ? `Latest run: ${input.latestJob.label}` : "Latest ingest run",
      description: `Status: ${input.latestJob.status}. Open the run console for logs and results.`,
      href: `${RUNS_HREF}/${input.latestJob.id}?from=hub`,
      cta: "Open run",
    });
  } else {
    actions.push({
      id: "latest_run",
      title: "Ingest runs",
      description: "Browse past runs and open the run console for any job.",
      href: RUNS_HREF,
      cta: "View runs",
    });
  }

  actions.push({
    id: "agents",
    title: input.surrealStoreReady ? "Agent MCP setup" : "Agent access",
    description: input.surrealStoreReady
      ? "Copy MCP snippets for connect.search against your graph."
      : "Gateway key and REST retrieve for agents using your workspace graph.",
    href: AGENTS_HREF,
    cta: input.surrealStoreReady ? "MCP setup" : "Agent setup",
  });

  actions.push({
    id: "change_settings",
    title: "Pipeline settings",
    description: "Change graph store, domain pack, sources, or routes without starting a run.",
    href: pipelineWizardHref("launch"),
    cta: "Change settings",
  });

  return actions;
}

export type ConnectHubCta = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

/** Single primary action for the Connect hub control panel cap stripe. */
export function resolveConnectHubPrimaryAction(params: {
  phase: ConnectJourneyPhase;
  nextStep: ConnectSetupStep | null;
  operationalActions: ConnectOperationalAction[] | null;
}): ConnectHubCta {
  if (params.phase === "operational" && params.operationalActions?.length) {
    const primary = params.operationalActions.find((a) => a.primary) ?? params.operationalActions[0]!;
    return {
      title: primary.title,
      description: primary.description,
      href: primary.href,
      cta: primary.cta,
    };
  }
  if (params.nextStep) {
    return {
      title: params.nextStep.title,
      description: params.nextStep.description,
      href: params.nextStep.href,
      cta: params.nextStep.cta,
    };
  }
  return {
    title: "Run ingest — turn docs into agent-ready context",
    description: "Start a named run using the pipeline you configured.",
    href: pipelineWizardHref("launch"),
    cta: "Start your run",
  };
}

const HUB_SECONDARY_OMIT_WHEN_GRAPH_CTA = new Set<ConnectOperationalAction["id"]>(["view_graph"]);
const HUB_SECONDARY_OMIT_WHEN_RUN_TILE = new Set<ConnectOperationalAction["id"]>(["latest_run"]);
const HUB_SECONDARY_OMIT_ALWAYS = new Set<ConnectOperationalAction["id"]>(["new_run"]);

/** Secondary hub actions — omits items already surfaced in the ledger hero (graph CTA, run tile, cap primary). */
export function resolveConnectHubSecondaryActions(params: {
  phase: ConnectJourneyPhase;
  operationalActions: ConnectOperationalAction[] | null;
  /** True when graph pulse exposes Review graph (dedupe view_graph action). */
  ledgerShowsGraphCta: boolean;
  /** True when latest run tile is shown in graph pulse (dedupe latest_run action). */
  ledgerShowsLatestRun: boolean;
}): ConnectOperationalAction[] {
  if (params.phase !== "operational" || !params.operationalActions?.length) return [];
  const omit = new Set(HUB_SECONDARY_OMIT_ALWAYS);
  if (params.ledgerShowsGraphCta) {
    for (const id of HUB_SECONDARY_OMIT_WHEN_GRAPH_CTA) omit.add(id);
  }
  if (params.ledgerShowsLatestRun) {
    for (const id of HUB_SECONDARY_OMIT_WHEN_RUN_TILE) omit.add(id);
  }
  return params.operationalActions.filter((a) => !omit.has(a.id));
}

// ─────────────────────────────────────────────────────────────────────────────
// M0–M4 onboarding milestone position (RES-113 PR-F)
//
// Maps the server-derived Connect spine signals → the single milestone the user
// is positioned at (m0 Explore → m4 Connect) plus ONE honest next action.
//
// ONE adaptive path, NO personas (REC-ADR-020): depth (M2 Verify / M3 Store) is
// surfaced from real graph state, never a pre-assigned archetype. The position
// is DERIVED from the same server payload the spine already consumes — there is
// NO persisted client graph store (REC-ADR-021 §5). This deliberately REUSES the
// five-stage spine (connect·ingest·make_ready·review·go_live) rather than adding
// a parallel state machine: the milestone is a view over the spine's stage
// states, and the next action is the spine's own honest current-stage CTA.
//
//   Mandatory spine (every user):  m0 → m1 → m4   (REC-ADR-020)
//   Opt-in depth, surfaced by state:
//     • m2 Verify — when the graph has make-ready / review work outstanding.
//     • m3 Store  — only when the user has opted into bringing their own DB;
//                   never forced (managed default ⇒ m3 skipped).
//
// Milestone ↔ spine stage groups (the spine remains the engine of truth):
//   m0/m1 ← connect + ingest   m2 ← make_ready + review   m4 ← go_live
//   m3 has no spine stage (own-DB is an advanced affordance, not a gate).
//
// Consumed by PR-B…E (per-milestone reskins: which surface leads) and PR-G (the
// IA re-spine: which Home tile / section is primary).
// ─────────────────────────────────────────────────────────────────────────────

export type OnboardingMilestoneId = "m0" | "m1" | "m2" | "m3" | "m4";

export type OnboardingMilestoneSection = "home" | "build" | "verify" | "store" | "connect";

/** Milestone → section slug (05_STATE.md §4: m0→home, m1→build, m2→verify, m3→store, m4→connect). */
export const MILESTONE_SECTION: Record<OnboardingMilestoneId, OnboardingMilestoneSection> = {
  m0: "home",
  m1: "build",
  m2: "verify",
  m3: "store",
  m4: "connect",
};

/** Human label for each milestone (the verb spine). */
export const MILESTONE_LABEL: Record<OnboardingMilestoneId, string> = {
  m0: "Explore",
  m1: "Build",
  m2: "Verify",
  m3: "Store",
  m4: "Connect",
};

/** A single honest next action — disabled-with-reason when it cannot act yet. */
export type OnboardingNextAction = {
  /** Which milestone this action advances. */
  milestone: OnboardingMilestoneId;
  label: string;
  href: string;
  /** Render inert + show `disabledReason` when true. Never clickable-but-inert. */
  disabled: boolean;
  disabledReason: string | null;
};

export type OnboardingMilestonePosition = {
  /** First incomplete milestone in the adaptive path (the user's current position). */
  milestone: OnboardingMilestoneId;
  label: string;
  section: OnboardingMilestoneSection;
  /** "complete" only once m4 is reached and satisfied (live); otherwise "current". */
  status: "current" | "complete";
  /** Milestones already satisfied (mandatory + any engaged opt-in depth). */
  completed: OnboardingMilestoneId[];
  /** Opt-in depth currently relevant: m2 when there is verify work; m3 when own-DB is engaged. */
  availableDepth: OnboardingMilestoneId[];
  /** The one recommended next action — reused from the spine's current-stage CTA where one exists. */
  nextAction: OnboardingNextAction;
};

export type OnboardingMilestoneSignals = {
  /** The same deriving-signals the Connect spine consumes (server-assembled, no client store). */
  spine: ConnectSpineSignals;
  /**
   * M3 own-store depth (opt-in; REC-ADR-017 / REC-ADR-020). `engaged` = the user
   * has chosen the bring-your-own-database path; `connected` = that store is
   * read-only-verified and saved. Absent ⇒ the managed default, so M3 is never
   * forced into the path.
   */
  ownStore?: { engaged: boolean; connected: boolean };
  /**
   * Count of live app connections / wired agents (M4 terminal — "live = connections>0",
   * 05_STATE.md §5). Absent ⇒ published stage routes are the proxy for "ready to connect".
   */
  connections?: number;
};

function milestoneStageState(spine: ConnectSpine, id: ConnectSpineStageId) {
  return spine.stages.find((s) => s.id === id)?.state ?? "unknown";
}

/**
 * Pick the honest CTA for a milestone from the spine: prefer the highlighted
 * current stage when it belongs to this milestone, else the first stage in the
 * group with outstanding work, else the group's first stage. Reuses the spine's
 * disabled-with-reason CTAs verbatim so the next action never drifts from it.
 */
function spineStageCta(spine: ConnectSpine, ...ids: ConnectSpineStageId[]): ConnectSpineCta | null {
  if (spine.currentStageId && ids.includes(spine.currentStageId)) {
    const current = spine.stages.find((s) => s.id === spine.currentStageId);
    if (current) return current.cta;
  }
  for (const id of ids) {
    const s = spine.stages.find((x) => x.id === id);
    if (s && s.state !== "done") return s.cta;
  }
  const first = spine.stages.find((x) => x.id === ids[0]);
  return first ? first.cta : null;
}

function nextActionFromSpine(
  milestone: OnboardingMilestoneId,
  cta: ConnectSpineCta | null,
  fallback: { label: string; href: string },
): OnboardingNextAction {
  return {
    milestone,
    label: cta?.label ?? fallback.label,
    href: cta?.href ?? fallback.href,
    disabled: cta?.disabled ?? false,
    disabledReason: cta?.disabledReason ?? null,
  };
}

function resolveMilestoneNextAction(
  milestone: OnboardingMilestoneId,
  status: "current" | "complete",
  spine: ConnectSpine,
  ctx: { routesLive: boolean },
): OnboardingNextAction {
  switch (milestone) {
    case "m0":
      // Toward building the first graph — the spine's setup / ingest entry.
      return nextActionFromSpine(milestone, spineStageCta(spine, "connect", "ingest"), {
        label: "Build your graph",
        href: pipelineWizardHref("store"),
      });
    case "m1":
      return nextActionFromSpine(milestone, spineStageCta(spine, "ingest", "connect"), {
        label: "Run ingest",
        href: INGEST_FLOW_HREF,
      });
    case "m2":
      return nextActionFromSpine(milestone, spineStageCta(spine, "make_ready", "review"), {
        label: "Verify your graph",
        href: CLAIMS_HREF + "?filter=review",
      });
    case "m3":
      // Own-DB is an advanced affordance with no spine stage of its own.
      return {
        milestone,
        label: "Connect your database",
        href: pipelineWizardHref("store"),
        disabled: false,
        disabledReason: null,
      };
    case "m4":
      if (status === "complete") {
        return {
          milestone,
          label: "Manage connections",
          href: AGENTS_HREF,
          disabled: false,
          disabledReason: null,
        };
      }
      // Current: publish stage routes first; once live, wire the first connection.
      if (!ctx.routesLive) {
        return nextActionFromSpine(milestone, spineStageCta(spine, "go_live"), {
          label: "Publish routes",
          href: INGEST_ROUTES_HREF,
        });
      }
      return {
        milestone,
        label: "Connect your app",
        href: AGENTS_HREF,
        disabled: false,
        disabledReason: null,
      };
  }
}

/**
 * Derive the M0–M4 milestone position + one next action from the server spine
 * signals. Pure + deterministic; no persisted client state (REC-ADR-021 §5).
 *
 * The position is the FIRST incomplete milestone walking the adaptive path
 * m0 → m1 → (m2 if verify work) → (m3 if own-DB engaged) → m4. Completion is
 * read from the spine's own stage states (m2/m4) plus the raw build/own-store
 * signals (m0/m1/m3), so the milestone never contradicts the spine ledger.
 */
export function deriveOnboardingMilestone(
  signals: OnboardingMilestoneSignals,
): OnboardingMilestonePosition {
  const spine = buildConnectSpine(signals.spine);
  const g = signals.spine.graph;
  const ingest = signals.spine.ingest;
  const readiness = signals.spine.readiness;

  // m0 Explore completes once the user moves past pure exploration — a run has
  // been started OR a graph exists (REC-ADR-021 M0: "M0 collapses into 'ask your
  // graph' once ingested").
  const hasRun = Boolean(ingest && (ingest.jobCount > 0 || ingest.latestJob !== null));
  const graphBuilt = Boolean(g && g.units > 0);
  const m0done = hasRun || graphBuilt;

  // m1 Build completes when the graph actually exists.
  const m1done = graphBuilt;

  // m2 Verify: relevant (and outstanding) when make-ready / review still has work.
  // Derived straight from the spine's stage states so embed + validate + triage
  // all count — no parallel recomputation.
  const makeReadyState = milestoneStageState(spine, "make_ready");
  const reviewState = milestoneStageState(spine, "review");
  const verifyOutstanding = graphBuilt && (makeReadyState === "current" || reviewState === "current");
  const m2done = graphBuilt && !verifyOutstanding;

  // m3 Store: opt-in advanced depth — only enters the path when the user has
  // engaged the bring-your-own-DB flow; never forced.
  const ownEngaged = signals.ownStore?.engaged ?? false;
  const ownConnected = signals.ownStore?.connected ?? false;
  const storeOutstanding = ownEngaged && !ownConnected;
  const m3done = ownEngaged && ownConnected;

  // m4 Connect: live when stage routes are published (and a graph exists) or,
  // when a connection count is supplied, when at least one app is connected.
  const routesLive = Boolean(readiness && readiness.models.modelsReady);
  const connectionsSatisfied =
    signals.connections === undefined ? routesLive && graphBuilt : signals.connections > 0;
  const m4done = connectionsSatisfied;

  const completed: OnboardingMilestoneId[] = [];
  if (m0done) completed.push("m0");
  if (m1done) completed.push("m1");
  if (m2done) completed.push("m2");
  if (m3done) completed.push("m3");
  if (m4done) completed.push("m4");

  const availableDepth: OnboardingMilestoneId[] = [];
  if (verifyOutstanding) availableDepth.push("m2");
  if (ownEngaged) availableDepth.push("m3");

  let milestone: OnboardingMilestoneId;
  if (!m0done) milestone = "m0";
  else if (!m1done) milestone = "m1";
  else if (verifyOutstanding) milestone = "m2";
  else if (storeOutstanding) milestone = "m3";
  else milestone = "m4";

  const status: "current" | "complete" = milestone === "m4" && m4done ? "complete" : "current";
  const nextAction = resolveMilestoneNextAction(milestone, status, spine, { routesLive });

  return {
    milestone,
    label: MILESTONE_LABEL[milestone],
    section: MILESTONE_SECTION[milestone],
    status,
    completed,
    availableDepth,
    nextAction,
  };
}
