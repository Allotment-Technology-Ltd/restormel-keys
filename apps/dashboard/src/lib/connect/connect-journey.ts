/**
 * Connect hub journey — single source of truth for initial vs operational mode,
 * setup step order, and primary next actions.
 */
import { AGENTS_HREF, CLAIMS_HREF, RUNS_HREF, INGEST_ROUTES_HREF } from "$lib/nav-config";
import { pipelineWizardHref, withReturnTo, type PipelineWizardStepId } from "$lib/connect/pipeline-config";


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
  } = input;

  const prerequisitesForRun = Boolean(target && parsedDocumentCount > 0 && modelsReady);
  const nextRequired = resolveNextSetupStepId({
    hasGraphStore: Boolean(target),
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
      description:
        "Use your workspace database in one click, or connect SurrealDB you manage so extracted ideas and edges have a durable graph home.",
      status: target ? "done" : "todo",
      detail: target
        ? target.provider === "surreal"
          ? target.status === "ok"
            ? "SurrealDB connected"
            : `SurrealDB (${target.status})`
          : `Connected: ${target.provider}`
        : "Not connected yet",
      href: pipelineWizardHref("store"),
      cta: target ? "Review store" : "Connect store",
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
        "While a run is in progress, watch each stage complete. After ingest, review validation in the graph explorer.",
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
        : "Run ingest and open the graph explorer first",
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
      href: pipelineWizardHref("launch"),
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
