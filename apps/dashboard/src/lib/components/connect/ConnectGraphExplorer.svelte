<script lang="ts">
  import { goto } from "$app/navigation";
  import { HOME_HREF, RUNS_HREF } from "$lib/nav-config";
  import { page } from "$app/stores";
  import { get } from "svelte/store";
  import {
    CONNECT_MODELS_BASE,
    CONNECT_PIPELINE_API,
    pipelineWizardHref,
    withReturnTo,
    type BuilderReturnContext,
  } from "$lib/connect/pipeline-config";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import BrutalBadge from "$lib/components/brutalist/BrutalBadge.svelte";
  import BrutalBentoCell from "$lib/components/brutalist/BrutalBentoCell.svelte";
  import BrutalBentoGrid from "$lib/components/brutalist/BrutalBentoGrid.svelte";
  import BrutalButton from "$lib/components/brutalist/BrutalButton.svelte";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";
  import ConnectGraphReadinessWizard from "$lib/components/connect/ConnectGraphReadinessWizard.svelte";
  import ConnectReadinessLibrary from "$lib/components/connect/ConnectReadinessLibrary.svelte";
  import type { ReadinessRunSummary } from "$lib/components/connect/ConnectReadinessLibrary.svelte";
  import {
    formatHumanReviewNote,
    isAwaitingHumanTriage,
    normalizeValidationStatus,
  } from "$lib/connect/validation-status";
  import { buildGraphReviewGlossarySections } from "$lib/connect/graph-review-glossary";
  import {
    GRAPH_REVIEW_VERDICT_LEGEND,
    GRAPH_REVIEW_VERDICT_VISUAL,
    graphReviewVerdictVisual,
  } from "$lib/connect/graph-review-verdict-visual";
  import {
    graphReviewGuidance,
    isSuggestedReviewAction,
    reviewActionFillClass,
    type ReviewVerdictAction,
  } from "$lib/connect/graph-review-guidance";
  import {
    GRAPH_REVIEW_COMMON_STEPS,
    type GraphReviewCoaching,
  } from "$lib/connect/graph-review-coaching";
  import { sortGraphUnitsForReview } from "$lib/connect/graph-unit-sort";
  import {
    parseExplorerUrlState,
    buildExplorerUrl,
    normalizeAsOf,
  } from "$lib/connect/explorer-url-state";
  import {
    canAcceptAsSupported,
    facetForUrlFilter,
    predatesEvidenceBinding,
    recheckResultCopy,
    unitMatchesEvidenceFacet,
    urlFilterForFacet,
    VERIFICATION_STATES,
    VERIFICATION_STATE_VISUAL,
    verificationStampVisual,
    type ConnectEvidenceDossier,
    type RecheckOutcome,
    type UnitEvidenceSummary,
    type VerificationState,
  } from "$lib/connect/evidence-dossier";
  import { connectReviewCount } from "$lib/stores/connect-review-count";
  import { replaceState } from "$app/navigation";
  import { onMount } from "svelte";
  import ClaimsStampingDesk from "$lib/components/connect/ClaimsStampingDesk.svelte";
  import {
    emptyDeskTally,
    tallyStamp,
    tallyUndo,
    announceStamp,
    type DeskTally,
    type DeskStampRecord,
  } from "$lib/connect/claims-stamping-desk";

  type Member = { text: string; role: string | null; validationStatus: string | null };
  type Group = { id: string; name: string; summary: string | null; members: Member[] };
  type Unit = {
    id: string;
    text: string;
    unitType: string | null;
    domain: string | null;
    validationStatus: string | null;
    validationNote: string | null;
    sourceTitle: string | null;
    sourceUrl: string | null;
    sourceKind: string | null;
    author: string | null;
    /** EBV summary (W2.2 Evidence Dossier); null/absent = predates evidence binding. */
    evidence?: UnitEvidenceSummary | null;
    /**
     * W2.5 — true when this row is a substituted/superseded PRIOR version served under an
     * as-of/audit projection. Its triage/provenance fields are neutralized server-side
     * (not reconstructible at the instant); the UI labels the verdict as not-historical.
     */
    asOfHistorical?: boolean;
  };
  type Stats = {
    units: number;
    relations: number;
    groups: number;
    embedded: number;
    validation: {
      ok: number;
      weak: number;
      unsupported: number;
      unvalidated: number;
      awaiting_triage?: number;
      unsupported_untriaged?: number;
    };
  };
  type Graph = {
    store?: "postgres" | "surreal" | "none";
    storeLabel?: string;
    targetStatus?: "untested" | "error";
    domainPackId?: string | null;
    domainPackTitle?: string | null;
    reviewEnabled?: boolean;
    stats: Stats | null;
    /** True while the quick unit-count skeleton is being served; relations/groups/embedded are not yet computed. */
    statsPartial?: boolean;
    groups: Group[];
    units: Unit[];
    unitsLoadError?: string | null;
    unitsPagination?: {
      offset: number;
      limit: number;
      loaded: number;
      total: number | null;
      hasMore: boolean;
    };
    sourceCatalogStatus?: {
      pipelineCatalogCount: number;
      sourcesInPipeline: boolean;
    };
    /** Evidence facet counts (W2.2); null = the store could not answer. */
    evidenceStates?: Record<VerificationState, number> | null;
  };

  export let graph: Graph;

  export let revalidate: {
    enabled: boolean;
    projectId?: string;
    routes: {
      id: string;
      name: string;
      isDefault: boolean;
      visualHref?: string;
      activeModel?: { modelId: string; provider: string } | null;
    }[];
    defaultRouteId: string | null;
    remediationRoutes?: {
      id: string;
      name: string;
      isDefault: boolean;
      visualHref?: string;
      activeModel?: { modelId: string; provider: string } | null;
    }[];
    defaultRemediationRouteId?: string | null;
    quarantineCount?: number;
    unsupportedUntriagedCount?: number;
    embedReady?: boolean;
  } | null = null;

  const GRAPH_AUTO_REMEDIATE_RETURN: BuilderReturnContext = { kind: "graph-auto-remediate" };
  const GRAPH_EMBED_RETURN: BuilderReturnContext = { kind: "graph-embed-backfill" };

  function withAutoRemediateReturn(href: string): string {
    return withReturnTo(href, GRAPH_AUTO_REMEDIATE_RETURN);
  }

  function withEmbedBackfillReturn(href: string): string {
    return withReturnTo(href, GRAPH_EMBED_RETURN);
  }

  $: modelsManageHref = withAutoRemediateReturn(CONNECT_MODELS_BASE);
  $: selectedValidationRoute =
    (revalidateOptions?.routes ?? []).find((route) => route.id === revalidateRouteId) ?? null;
  $: selectedRemediationRoute =
    (revalidateOptions?.remediationRoutes ?? []).find((route) => route.id === remediationRouteId) ??
    null;
  $: validationRouteEditHref = selectedValidationRoute?.visualHref
    ? withAutoRemediateReturn(selectedValidationRoute.visualHref)
    : null;
  $: remediationRouteEditHref = selectedRemediationRoute?.visualHref
    ? withAutoRemediateReturn(selectedRemediationRoute.visualHref)
    : null;

  let revalidateOptions = revalidate;
  let revalidateOptionsLoading = false;


  /** Paginate triage list when filtered ideas exceed this count. */
  const QUEUE_PAGE_SIZE = 40;

  type QueueScope = "review" | "all";
  type VerdictFilter = "ok" | "weak" | "unsupported" | "unknown";

  type RelationPreview = {
    relationType: string;
    fromText: string;
    toText: string;
    fromUnitId: string | null;
    toUnitId: string | null;
  };

  // ── URL-state initialisation (W2.1) ────────────────────────────────────────
  // Parse synchronously so the correct queue state renders on first paint —
  // same pattern as the existing workspaceMode initialisation.
  const _initialUrlState = (() => {
    try {
      return parseExplorerUrlState(get(page).url.searchParams);
    } catch {
      return parseExplorerUrlState(new URLSearchParams());
    }
  })();

  let queueScope: QueueScope = _initialUrlState.queueScope;
  /** Optional verdict narrow — applies on top of Quarantine or All ideas. */
  let verdictFilter: VerdictFilter | null = _initialUrlState.verdictFilter;
  /**
   * Evidence facet (W2.2): narrow the queue to one EBV verification state.
   * Inbound `?filter=` values map through facetForUrlFilter (abstained → unverified).
   */
  let verificationStateFilter: VerificationState | null = _initialUrlState.verificationStateFilter
    ? facetForUrlFilter(_initialUrlState.verificationStateFilter)
    : null;
  /**
   * True when the page was reached via a quality CTA with ?filter=review.
   * Drives the dismissible context line (C-P2-1).
   */
  let ctaContextDismissed = false;
  const _ctaArrival = _initialUrlState.queueScope === "review" && !_initialUrlState.verdictFilter;
  let showCtaContext = _ctaArrival && get(page).url.searchParams.has("filter");
  let extraUnits: Unit[] = [];
  let loadingMoreUnits = false;
  let loadMoreError: string | null = null;
  /**
   * W2.5 pagination basis (minor 1): the server pages CURRENT rows by `offset`, but in
   * as-of mode the projected list length differs from the current-row count (born-after-t
   * rows are excluded, substituted rows replace 1:1, audit rows append). Paging by the
   * projected `units.length` would skip/repeat rows and never let `hasMore` go false. We
   * track the raw count of CURRENT rows fetched here (the honest next offset) and the
   * latest server `has_more` so "Load more" terminates. null until a client fetch resolves.
   */
  let rawRowsFetched: number | null = null;
  let serverHasMore: boolean | null = null;
  /** Client-side verdict/evidence overrides until the next server graph reload. */
  let unitOverrides: Record<string, Partial<Unit>> = {};
  /** Ideas removed this session (hidden immediately; persisted in background). */
  let removedIds: Record<string, true> = {};
  type StatsDelta = {
    units: number;
    ok: number;
    weak: number;
    unsupported: number;
    unvalidated: number;
    awaiting_triage: number;
    unsupported_untriaged: number;
  };
  const emptyStatsDelta = (): StatsDelta => ({
    units: 0,
    ok: 0,
    weak: 0,
    unsupported: 0,
    unvalidated: 0,
    awaiting_triage: 0,
    unsupported_untriaged: 0,
  });
  let statsDelta: StatsDelta = emptyStatsDelta();
  /** Selected unit id — initialised from ?unit= URL param (W2.1). */
  let selectedId: string | null = _initialUrlState.selectedUnitId;

  // ── As-of time travel (W2.5) ────────────────────────────────────────────────
  /**
   * As-of instant (ISO) or null for live ("now"). Initialised from ?as_of= so a
   * shared historical link opens in the past state. While set, the explorer is
   * read-only: mutating affordances are hidden (a state class on the root, working
   * on desktop too) and the verdict keyboard shortcuts early-return.
   */
  let asOf: string | null = _initialUrlState.asOf ?? null;
  /** Include-superseded audit flag (?audit=1) — shows every version of each chain. */
  let includeSuperseded: boolean = _initialUrlState.includeSuperseded ?? false;
  /** Draft value bound to the date-time picker before the operator applies it. */
  let asOfDraft = "";
  /**
   * Honest report from the units API: whether the requested as-of view was applied
   * by the data layer, or degraded ("history not available for this graph"). null
   * until the first as-of fetch resolves. Mirrors the server's AsOfStatus shape.
   */
  type AsOfStatusView = {
    requested: boolean;
    applied?: boolean;
    asOf?: string | null;
    includeSuperseded?: boolean;
    reason?: string;
    excluded?: number;
    substituted?: number;
    supersededReturned?: number;
    unversioned?: number;
  };
  let asOfStatus: AsOfStatusView | null = null;
  /** True whenever a historical view is active — drives read-only + the banner. */
  $: asOfActive = asOf != null || includeSuperseded;
  /** True when an as-of was requested but the data layer could not answer it. */
  $: asOfDegraded = asOfStatus?.requested === true && asOfStatus?.applied === false;
  /**
   * True only when a historical projection is ACTIVE and the data layer genuinely applied
   * it (not degraded). This gates the absent-state for current-only numbers: the bento,
   * validation breakdown and evidence facet counts are SSR-current `graph.stats` and are
   * NOT projected to the instant, so under an applied historical view they must be hidden
   * rather than shown beneath the "as of …" banner as if they were historical (B1). When
   * degraded, the current view is shown honestly as current, so the numbers stay visible.
   */
  $: asOfProjected = asOfActive && asOfStatus?.applied === true;
  let reviewNote = "";
  let actionError: string | null = null;
  let exitingUnitId: string | null = null;
  // ── Evidence Dossier state (W2.2) ───────────────────────────────────────
  /** Per-unit dossier cache (excerpt, custody, versions) — refetched on demand. */
  let dossierCache: Record<string, ConnectEvidenceDossier> = {};
  let dossierLoading = false;
  let dossierError: string | null = null;
  let dossierUnitId: string | null = null;
  let recheckBusy = false;
  /** Latest deterministic re-check result per unit (session-local, honest). */
  let recheckOutcomes: Record<string, RecheckOutcome> = {};
  let evidenceActionBusy = false;
  let evidenceActionError: string | null = null;
  /** Optimistic facet-count shifts until the next server reload. */
  let evidenceDelta: Partial<Record<VerificationState, number>> = {};
  let flashingReviewAction: ReviewVerdictAction | null = null;
  // ── Stamping Desk (W4.2) — keyboard-first triage focus mode ──────────────
  /** True while the desk overlay owns the keyboard (the explorer's own keydown defers). */
  let deskActive = false;
  /** Per-visit session tally — reset when the desk is entered. */
  let deskTally: DeskTally = emptyDeskTally();
  /** Last landed stamp this session (for honest single-level undo). */
  let deskLastStamp: DeskStampRecord | null = null;
  /** Handle to the desk component so the explorer can drive focus + announce. */
  let deskComponent: ClaimsStampingDesk | null = null;
  let revalidateRouteId = "";
  let remediationRouteId = "";
  // Remediation run controls (mode "remediate").
  let remediateStrictness: "conservative" | "balanced" | "strict" = "balanced";
  /** null = use the level's default confidence threshold. */
  let remediateThreshold: number | null = null;
  let remediateBatchSize = 500;
  let remediateContinueInBackground = false;
  $: if (revalidateOptions?.defaultRouteId && !revalidateRouteId) {
    revalidateRouteId = revalidateOptions.defaultRouteId;
  }
  $: if (revalidateOptions?.defaultRemediationRouteId && !remediationRouteId) {
    remediationRouteId = revalidateOptions.defaultRemediationRouteId;
  }
  let autoRemediating = false;
  let revalidateError: string | null = null;
  // Batch validation of the "unchecked" backlog (overnight / background friendly).
  let batchValidating = false;
  let batchValidateError: string | null = null;
  let batchSize = 2000;
  let continueInBackground = true;
  let validateScope: "unchecked" | "linked" = "unchecked";
  // Pre-existing BYO (Surreal) graphs default to the free, no-LLM trust path.
  let validateMode: "ai" | "trust_provenance" =
    graph?.store === "surreal" ? "trust_provenance" : "ai";
  let linkSourcesOptions: {
    enabled: boolean;
    unitsNeedingLink: number;
    estimate?: boolean;
    candidateSources: number;
    totalUnits: number;
  } | null = null;
  let linkSourcesOptionsLoading = false;
  let linkSourcesScope: "unlinked_only" | "all" = "unlinked_only";
  let linkingSources = false;
  let linkSourcesError: string | null = null;
  let provenanceAudit: import("$lib/connect/graph-provenance-audit-types").ProvenanceAuditView | null =
    null;
  let provenanceAuditLoading = false;
  let provenanceAuditError: string | null = null;
  // Source catalog discovery — for BYO graphs not created by Restormel
  type DiscoveredSource = {
    key: string;
    title: string | null;
    url: string | null;
    kind: string | null;
    hasFullText: boolean;
    hasPreviewText: boolean;
    textOrigin?: "inline" | "passage" | "preview_only" | "none";
    passageCount?: number;
  };
  type DiscoverScanMeta = {
    sourceTable: string;
    passageTable: string;
    inlineFields: string[];
    passageTextField: string;
    passageSourceField: string;
  };
  type PackMappingFields = {
    source_table: string;
    passage_table: string;
    source_text_field?: string;
    passage_text_field?: string;
    passage_source_field?: string;
  };
  type PackSuggestion = {
    packId: string;
    packTitle: string;
    packSlug: string;
    canAutoApply: boolean;
    reason: string;
    confidence: "high" | "medium" | "low";
    changes: string[];
    current?: PackMappingFields;
    suggested?: PackMappingFields;
  };
  type DiscoverResult = {
    storeType: string;
    sources: DiscoveredSource[];
    total: number;
    withText: number;
    withoutText: number;
    withPassageText?: number;
    withInlineText?: number;
    scanMeta?: DiscoverScanMeta;
    domainPackId?: string;
    packTitle?: string;
    packEditable?: boolean;
    currentMapping?: PackMappingFields;
    packSuggestion?: PackSuggestion | null;
    packSynced?: boolean;
    mappingInvalid?: boolean;
    pipelineCatalogCount?: number;
    importAlreadySatisfied?: boolean;
  };
  type ImportResult = {
    imported: number;
    skipped: number;
    alreadyPresent: number;
    error?: string;
    message?: string;
  };
  let discoverResult: DiscoverResult | null = null;
  let discoveringLoading = false;
  let discoveringError: string | null = null;
  let syncingPack = false;
  let syncPackError: string | null = null;
  let packMappingForm: PackMappingFields = {
    source_table: "source",
    passage_table: "passage",
    source_text_field: "",
    passage_text_field: "",
    passage_source_field: "",
  };
  let packMappingEditable = true;
  let packMappingTitle = "";
  let packMappingLoaded = false;
  let packMappingLoading = false;
  let packMappingLoadError: string | null = null;
  let savingMapping = false;
  let saveMappingError: string | null = null;
  let importingLoading = false;
  let importResult: ImportResult | null = null;
  let importError: string | null = null;
  let catalogLinkStepComplete = false;
  let readinessEmbedStepComplete = false;

  // Readiness library: named cohort passes. activeRunId === null means "whole
  // workspace" (the original global-backlog behaviour); a run id scopes every
  // link/embed/validate dispatch to that run's stamped cohort.
  let readinessRuns: ReadinessRunSummary[] = [];
  let activeRunId: string | null = null;
  let runsLoading = false;
  let runsError: string | null = null;
  let creatingRun = false;
  $: activeRun = activeRunId ? readinessRuns.find((r) => r.id === activeRunId) ?? null : null;

  async function loadReadinessRuns() {
    runsLoading = true;
    runsError = null;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/readiness/runs`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        runsError = typeof body.message === "string" ? body.message : "Could not load readiness runs.";
        return;
      }
      readinessRuns = Array.isArray(body.runs) ? body.runs : [];
      if (activeRunId && !readinessRuns.some((r) => r.id === activeRunId)) activeRunId = null;
    } catch {
      runsError = "Network error while loading readiness runs.";
    } finally {
      runsLoading = false;
    }
  }

  async function createReadinessRun(size: number) {
    if (creatingRun || !(size > 0)) return;
    creatingRun = true;
    runsError = null;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/readiness/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          size_target: size,
          ...(graph.domainPackId ? { domain_pack_id: graph.domainPackId } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        runsError = typeof body.message === "string" ? body.message : "Could not create readiness run.";
        return;
      }
      if (typeof body.warning === "string") runsError = body.warning;
      await loadReadinessRuns();
      if (body.run?.id && (body.run.sizeActual ?? 0) > 0) {
        activeRunId = body.run.id;
        scrollToGraphReadinessWizard();
      }
    } catch {
      runsError = "Network error while creating readiness run.";
    } finally {
      creatingRun = false;
    }
  }

  async function archiveReadinessRun(runId: string) {
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/readiness/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (res.ok && activeRunId === runId) activeRunId = null;
      await loadReadinessRuns();
    } catch {
      runsError = "Network error while archiving readiness run.";
    }
  }

  $: graphReadinessToolsLoading =
    linkSourcesOptionsLoading || embedOptionsLoading || revalidateOptionsLoading;

  let toolsOptionsLoaded = false;
  let toolsOptionsLoadInFlight = false;

  const TOOLS_OPTIONS_TIMEOUT_MS = 25_000;

  async function fetchToolsJson(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TOOLS_OPTIONS_TIMEOUT_MS);
    try {
      return await fetch(url, { credentials: "include", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  function seedDiscoverFromServerCatalog() {
    const catalog = graph.sourceCatalogStatus;
    if (!catalog?.sourcesInPipeline || discoverResult) return;
    discoverResult = {
      storeType: graph.store ?? "surreal",
      sources: [],
      total: 0,
      withText: 0,
      withoutText: 0,
      pipelineCatalogCount: catalog.pipelineCatalogCount,
      importAlreadySatisfied: true,
      domainPackId: graph.domainPackId ?? undefined,
      packTitle: graph.domainPackTitle ?? undefined,
    };
  }

  async function refreshDiscoverIfNeeded() {
    if (graph.store !== "surreal") return;
    if (graph.sourceCatalogStatus?.sourcesInPipeline) {
      seedDiscoverFromServerCatalog();
      return;
    }
    const needsDiscoverRefresh =
      !discoverResult ||
      discoverResult.importAlreadySatisfied == null ||
      (discoverResult.withText > 0 &&
        (discoverResult.pipelineCatalogCount ?? 0) < discoverResult.withText);
    if (needsDiscoverRefresh) {
      await discoverSources({ autoSyncPack: false });
    }
  }

  async function ensureToolsOptions() {
    if (!graph.reviewEnabled || !graph.stats?.units) return;
    if (toolsOptionsLoaded || toolsOptionsLoadInFlight) return;
    toolsOptionsLoadInFlight = true;
    linkSourcesOptionsLoading = true;
    embedOptionsLoading = true;
    if (graph.store === "surreal") provenanceAuditLoading = true;
    if (!revalidateOptions?.enabled) revalidateOptionsLoading = true;
    try {
      const bundledRes = await fetchToolsJson(`${CONNECT_PIPELINE_API}/graph/tools-options`);
      const data = bundledRes ? await bundledRes.json().catch(() => ({})) : {};
      if (bundledRes?.ok) {
        if (!revalidateOptions?.enabled && data.revalidate) {
          revalidateOptions = data.revalidate;
          if (data.revalidate.defaultRouteId && !revalidateRouteId) {
            revalidateRouteId = data.revalidate.defaultRouteId;
          }
          if (data.revalidate.defaultRemediationRouteId && !remediationRouteId) {
            remediationRouteId = data.revalidate.defaultRemediationRouteId;
          }
        }
        if (data.linkSources) {
          linkSourcesOptions = data.linkSources;
        } else if (data.provenanceAudit && graph.stats?.units) {
          linkSourcesOptions = {
            enabled: data.provenanceAudit.verdict !== "native",
            unitsNeedingLink: data.provenanceAudit.needsEdgeRepair,
            estimate: data.provenanceAudit.verdict === "unknown" || undefined,
            candidateSources: 1,
            totalUnits: graph.stats.units,
          };
        }
        if (data.embedBackfill) {
          embedOptions = data.embedBackfill;
          if (data.embedBackfill.defaultRouteId && !embedRouteId) {
            embedRouteId = data.embedBackfill.defaultRouteId;
          }
        }
        if (graph.store === "surreal") {
          provenanceAuditError = null;
          if (data.provenanceAudit) {
            provenanceAudit = data.provenanceAudit;
          } else {
            provenanceAuditError = "Could not load provenance audit.";
          }
        }
      } else if (data.provenanceAudit && graph.stats?.units) {
        linkSourcesOptions = {
          enabled: data.provenanceAudit.verdict !== "native",
          unitsNeedingLink: data.provenanceAudit.needsEdgeRepair,
          estimate: data.provenanceAudit.verdict === "unknown" || undefined,
          candidateSources: 1,
          totalUnits: graph.stats.units,
        };
        if (graph.store === "surreal") {
          provenanceAuditError =
            typeof data.message === "string"
              ? data.message
              : "Could not load provenance audit.";
        }
      }
      toolsOptionsLoaded = true;
    } catch {
      provenanceAuditError = "Provenance audit timed out — expand the panel to retry after refresh.";
      // Partial tool panels still render with page stats when options time out.
    } finally {
      revalidateOptionsLoading = false;
      linkSourcesOptionsLoading = false;
      embedOptionsLoading = false;
      provenanceAuditLoading = false;
      toolsOptionsLoadInFlight = false;
    }
  }

  const graphReadinessStorageKey = () =>
    `connect:graph-readiness-wizard:${graph.domainPackId ?? "default"}`;

  function restoreGraphReadinessState() {
    if (typeof sessionStorage === "undefined") return;
    try {
      const raw = sessionStorage.getItem(graphReadinessStorageKey());
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        discoverResult?: DiscoverResult;
        importResult?: ImportResult;
        catalogLinkStepComplete?: boolean;
        readinessEmbedStepComplete?: boolean;
      };
      if (saved.discoverResult && !discoverResult) discoverResult = saved.discoverResult;
      if (saved.importResult && !importResult) importResult = saved.importResult;
      if (saved.catalogLinkStepComplete) catalogLinkStepComplete = true;
      if (saved.readinessEmbedStepComplete) readinessEmbedStepComplete = true;
    } catch {
      // ignore corrupt session snapshot
    }
  }

  function persistGraphReadinessState() {
    if (typeof sessionStorage === "undefined") return;
    if (!discoverResult && !importResult && !catalogLinkStepComplete && !readinessEmbedStepComplete) {
      return;
    }
    try {
      sessionStorage.setItem(
        graphReadinessStorageKey(),
        JSON.stringify({
          discoverResult,
          importResult,
          catalogLinkStepComplete,
          readinessEmbedStepComplete,
        }),
      );
    } catch {
      // quota / private mode
    }
  }

  $: persistGraphReadinessState();
  let embedOptions: {
    enabled: boolean;
    unembeddedCount: number;
    workCount: number;
    totalUnits: number;
    embeddedCount: number;
    embedReady: boolean;
    recommendedScope: "missing_only" | "uniform_target";
    health: {
      targetDimensions: number;
      dimensionBuckets: { dimensions: number; count: number }[];
      dominantDimension: number | null;
      hasMixedDimensions: boolean;
      mismatchedDimensionCount: number;
      workCount: number;
      actionNeeded: boolean;
      actionReason: "missing" | "mixed" | "wrong_dimension" | "none";
    };
    routes: {
      id: string;
      name: string;
      isDefault: boolean;
      visualHref?: string;
      activeModel?: { modelId: string; provider: string } | null;
    }[];
    defaultRouteId: string | null;
    previewUnits: { id: string; text: string }[];
  } | null = null;
  let embedOptionsLoading = false;
  let embedRouteId = "";
  let embeddingBackfill = false;
  let embedError: string | null = null;
  let graphReadinessWizardEl: HTMLDivElement | undefined;

  function scrollToGraphReadinessWizard() {
    requestAnimationFrame(() => {
      graphReadinessWizardEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  $: if (embedOptions?.defaultRouteId && !embedRouteId) {
    embedRouteId = embedOptions.defaultRouteId;
  }
  $: selectedEmbedRoute =
    (embedOptions?.routes ?? []).find((route) => route.id === embedRouteId) ?? null;
  $: embedRouteEditHref = selectedEmbedRoute?.visualHref
    ? withEmbedBackfillReturn(selectedEmbedRoute.visualHref)
    : null;
  $: embedModelsManageHref = withEmbedBackfillReturn(CONNECT_MODELS_BASE);
  let glossaryOpen = false;
  let reviewCoachingOpen = false;
  let reviewCoachingLoading = false;
  let reviewCoachingError: string | null = null;
  let reviewCoachingUnitId: string | null = null;
  let reviewCoachingCache: Record<string, GraphReviewCoaching> = {};

  type WorkspaceMode = "triage" | "clusters" | "tools";
  // Resolve synchronously so the correct tab renders on first paint — no flash.
  let workspaceMode: WorkspaceMode = (() => {
    try {
      return get(page).url.searchParams.get("workspace") === "tools" ? "tools" : "triage";
    } catch {
      return "triage";
    }
  })();
  let selectedGroupId: string | null = null;
  /** When set, the review queue only shows ideas that belong to this cluster. */
  let groupScopeId: string | null = null;
  let groupSearch = "";
  let queuePage = 0;
  let clusterRelations: RelationPreview[] = [];
  let clusterRelationsLoading = false;
  let clusterRelationsError: string | null = null;
  let clusterRelationsTruncated = false;
  let relationsFetchGen = 0;

  $: glossarySections = buildGraphReviewGlossarySections({
    includeRevalidate: Boolean(revalidateOptions?.enabled),
  });

  onMount(() => {
    restoreGraphReadinessState();
    seedDiscoverFromServerCatalog();
    void refreshDiscoverIfNeeded();
    void loadInitialUnits();
    void loadReadinessRuns();
    if (workspaceMode === "tools") {
      void ensureToolsOptions().then(() => {
        if (get(page).url.searchParams.get("focus") === "embed") {
          scrollToGraphReadinessWizard();
        }
      });
    }
  });

  $: if (workspaceMode === "tools" && graph.reviewEnabled && graph.stats?.units) {
    void ensureToolsOptions();
  }

  $: if (graph.reviewEnabled && graph.stats?.units && graph.units.length === 0 && !initialUnitsLoaded) {
    void loadInitialUnits();
  }

  $: units = sortGraphUnitsForReview(
    [...graph.units, ...extraUnits]
      .filter((u) => !removedIds[u.id])
      .map((u) => ({ ...u, ...unitOverrides[u.id] })),
  );
  $: stats = graph.stats
    ? {
        ...graph.stats,
        units: Math.max(0, graph.stats.units + statsDelta.units),
        validation: {
          ...graph.stats.validation,
          ok: Math.max(0, graph.stats.validation.ok + statsDelta.ok),
          weak: Math.max(0, graph.stats.validation.weak + statsDelta.weak),
          unsupported: Math.max(0, graph.stats.validation.unsupported + statsDelta.unsupported),
          unvalidated: Math.max(0, graph.stats.validation.unvalidated + statsDelta.unvalidated),
          awaiting_triage: Math.max(
            0,
            (graph.stats.validation.awaiting_triage ?? 0) + statsDelta.awaiting_triage,
          ),
          unsupported_untriaged: Math.max(
            0,
            (graph.stats.validation.unsupported_untriaged ?? 0) + statsDelta.unsupported_untriaged,
          ),
        },
      }
    : null;
  // ── Review-count store (W2.1) — keep badge in hub tab up-to-date ──────────
  $: {
    const count = stats?.validation?.awaiting_triage ?? null;
    connectReviewCount.set(count);
  }

  // ── URL write-back (W2.1) — shareable + back/forward safe ─────────────────
  // Runs whenever queue state changes; writes via replaceState so no new history
  // entry is created. Only runs client-side (typeof window check guards SSR).
  $: if (typeof window !== "undefined") {
    try {
      const newUrl = buildExplorerUrl(get(page).url, {
        queueScope,
        verdictFilter,
        verificationStateFilter: verificationStateFilter
          ? urlFilterForFacet(verificationStateFilter)
          : null,
        selectedUnitId: selectedId,
        asOf,
        includeSuperseded,
      });
      replaceState(newUrl, {});
    } catch {
      // Navigation not available (SSR or test environment) — ignore.
    }
  }

  $: unitsPagination = graph.unitsPagination ?? null;
  $: hasMoreUnits =
    // Prefer the server's honest `has_more` from the last CLIENT fetch (current-row based,
    // valid under as-of too). Fall back to SSR pagination, then to a current-only estimate
    // — but NEVER use the projected `units.length` against the current total under an applied
    // historical view (it would never terminate); there, defer entirely to the server.
    serverHasMore ??
    unitsPagination?.hasMore ??
    (asOfProjected ? false : stats != null && units.length < stats.units);
  $: unitsLoadedLabel = asOfProjected
    ? // Under an applied historical view the total (`stats.units`) is the CURRENT count,
      // not the projected total — mixing projected X over current Y would be dishonest, and
      // no projected total exists (the projection is per-page). Show only the loaded count.
      `${units.length.toLocaleString()} claim${units.length === 1 ? "" : "s"} in this projection (loaded)`
    : stats && stats.units > 0
      ? `${units.length.toLocaleString()} of ${stats.units.toLocaleString()} ideas loaded`
      : `${units.length.toLocaleString()} ideas loaded`;

  let prevGraphUnitsKey = "";
  $: graphUnitsKey = `${graph.units[0]?.id ?? ""}:${graph.units.length}:${graph.unitsPagination?.offset ?? 0}`;
  $: if (graphUnitsKey !== prevGraphUnitsKey) {
    prevGraphUnitsKey = graphUnitsKey;
    extraUnits = [];
    loadMoreError = null;
    unitOverrides = {};
    removedIds = {};
    statsDelta = emptyStatsDelta();
    initialUnitsLoaded = graph.units.length > 0;
    rawRowsFetched = null;
    serverHasMore = null;
  }

  let initialUnitsLoading = false;
  let initialUnitsLoaded = graph.units.length > 0;
  let initialUnitsAttempted = false;

  async function fetchUnitsPage(offset: number, limit: number): Promise<Unit[]> {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    });
    if (graph.domainPackId) params.set("domain_pack_id", graph.domainPackId);
    // W2.5 — pass the as-of instant / audit flag through to the read path. This is a
    // GET (read) only; it adds ZERO mutation fetches (the mutation pin must not move).
    if (asOf) params.set("as_of", asOf);
    if (includeSuperseded) params.set("audit", "1");
    const res = await fetch(`${CONNECT_PIPELINE_API}/graph/units?${params.toString()}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message ?? `Could not load ideas (HTTP ${res.status}).`);
    }
    if (data.units_load_error) {
      loadMoreError = data.units_load_error;
    }
    // Capture the honest as-of report (applied vs degraded). Absent on plain reads.
    if (data.as_of_status && typeof data.as_of_status === "object") {
      asOfStatus = data.as_of_status as AsOfStatusView;
    }
    // Track pagination on the CURRENT-row basis the server pages by (minor 1). The next
    // honest offset is `offset + limit` (the server pages `limit` current rows per page),
    // NOT the projected `units.length`. `has_more` is the server's current-row decision.
    const usedOffset = Number.isFinite(data.offset) ? Number(data.offset) : offset;
    const usedLimit = Number.isFinite(data.limit) ? Number(data.limit) : limit;
    serverHasMore = typeof data.has_more === "boolean" ? data.has_more : null;
    rawRowsFetched = serverHasMore ? usedOffset + usedLimit : null;
    return Array.isArray(data.units) ? (data.units as Unit[]) : [];
  }

  // ── As-of controls (W2.5) ───────────────────────────────────────────────────
  /** Re-load the first page under the current as-of/audit setting (a read). */
  async function reloadUnitsForAsOf() {
    // Force a fresh initial load so the projected page replaces the live one.
    initialUnitsLoaded = false;
    initialUnitsAttempted = false;
    extraUnits = [];
    selectedId = null;
    loadMoreError = null;
    initialUnitsLoading = true;
    try {
      extraUnits = await fetchUnitsPage(0, unitsPagination?.limit ?? 150);
      initialUnitsLoaded = true;
    } catch (err) {
      loadMoreError =
        err instanceof Error ? err.message : "Network error while loading the historical view.";
      // Minor 4 — don't leave a confident "Viewing graph as of …" banner over an errored
      // list. Mark the as-of request degraded so the banner drops to its honest "history
      // could not be read" state instead of asserting the projection succeeded.
      asOfStatus = {
        requested: true,
        applied: false,
        asOf,
        includeSuperseded,
        reason: "as_of_fetch_failed",
      };
    } finally {
      initialUnitsLoading = false;
    }
  }

  /** Apply the picker draft as the active as-of instant. */
  function applyAsOfDraft() {
    const next = normalizeAsOf(asOfDraft);
    if (!next) return;
    asOf = next;
    void reloadUnitsForAsOf();
  }

  /** Jump to a preset anchor (a readiness-run timestamp or "now"). */
  function applyAsOfAnchor(iso: string | null) {
    asOf = iso ? normalizeAsOf(iso) : null;
    asOfDraft = asOf ? toDatetimeLocal(asOf) : "";
    void reloadUnitsForAsOf();
  }

  /** One-click return to the live ("now") view. */
  function returnToNow() {
    asOf = null;
    includeSuperseded = false;
    asOfDraft = "";
    asOfStatus = null;
    void reloadUnitsForAsOf();
  }

  /** Toggle the include-superseded audit flag and reload. */
  function toggleIncludeSuperseded() {
    includeSuperseded = !includeSuperseded;
    void reloadUnitsForAsOf();
  }

  /** Format an ISO instant for a `datetime-local` input (local time, minute precision). */
  function toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** Human-readable label for the active instant (banner copy). */
  function fmtAsOfLabel(iso: string | null): string {
    if (!iso) return "the selected time";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * As-of anchors: readiness-run timestamps (newest first) the operator can jump to.
   * `updatedAt` is epoch-ms; we view "as of" the moment each run last wrote, so a run's
   * verdicts and the claim states it produced are reconstructible at that instant.
   */
  $: asOfAnchors = (readinessRuns ?? [])
    .map((r): { id: string; iso: string | null; label: string } => ({
      id: r.id,
      iso: Number.isFinite(r.updatedAt) ? new Date(r.updatedAt).toISOString() : null,
      label: r.label ?? "",
    }))
    .filter((a): a is { id: string; iso: string; label: string } => a.iso !== null)
    .sort((a, b) => b.iso.localeCompare(a.iso))
    .slice(0, 6);

  /** Initialise the picker draft from the URL-provided as-of on mount. */
  $: if (asOf && !asOfDraft) asOfDraft = toDatetimeLocal(asOf);

  async function loadInitialUnits() {
    if (initialUnitsLoading || initialUnitsLoaded || initialUnitsAttempted) return;
    if (!graph.stats?.units || graph.units.length > 0) {
      initialUnitsLoaded = graph.units.length > 0;
      return;
    }
    initialUnitsAttempted = true;
    initialUnitsLoading = true;
    loadMoreError = null;
    try {
      const incoming = await fetchUnitsPage(0, unitsPagination?.limit ?? 150);
      extraUnits = incoming;
      initialUnitsLoaded = true;
    } catch (err) {
      loadMoreError =
        err instanceof Error ? err.message : "Network error while loading ideas.";
    } finally {
      initialUnitsLoading = false;
    }
  }

  async function loadMoreUnits() {
    if (loadingMoreUnits || !hasMoreUnits) return;
    loadingMoreUnits = true;
    loadMoreError = null;
    try {
      // Offset on the CURRENT-row basis the server pages by (minor 1) — NOT the projected
      // `units.length`, which under as-of diverges (excluded/substituted/audit rows) and
      // would skip or repeat rows. `rawRowsFetched` tracks the next current-row offset from
      // the last client fetch; before any client fetch, fall back to the SSR page extent.
      const nextOffset =
        rawRowsFetched ?? (unitsPagination?.offset ?? 0) + graph.units.length;
      const incoming = await fetchUnitsPage(nextOffset, unitsPagination?.limit ?? 150);
      const seen = new Set(units.map((u) => u.id));
      extraUnits = [...extraUnits, ...incoming.filter((u) => !seen.has(u.id))];
    } catch (err) {
      loadMoreError =
        err instanceof Error ? err.message : "Network error while loading more ideas.";
    } finally {
      loadingMoreUnits = false;
    }
  }
  $: storeLabel = graph.storeLabel ?? "Graph store";
  $: reviewEnabled = graph.reviewEnabled !== false && graph.store !== "none";
  $: unitsLoadError = graph.unitsLoadError ?? null;
  $: loadedNeedsReviewCount = units.filter((u) =>
    isAwaitingHumanTriage(u.validationStatus, u.validationNote),
  ).length;
  $: unembeddedCount =
    embedOptions?.workCount ??
    embedOptions?.unembeddedCount ??
    Math.max(0, (stats?.units ?? 0) - (stats?.embedded ?? 0));

  $: quarantineCount =
    stats?.validation.awaiting_triage ?? revalidateOptions?.quarantineCount ?? loadedNeedsReviewCount;
  $: needsReviewCount = quarantineCount;
  $: uncheckedCount = stats ? stats.validation.unvalidated : 0;

  $: sourcesInPipeline = Boolean(
    graph.sourceCatalogStatus?.sourcesInPipeline ||
      discoverResult?.importAlreadySatisfied ||
      (discoverResult?.pipelineCatalogCount ?? 0) > 0,
  );

  $: catalogImportSatisfied = Boolean(
    sourcesInPipeline ||
      discoverResult?.importAlreadySatisfied ||
      (discoverResult?.withText &&
        discoverResult.withText > 0 &&
        (discoverResult.pipelineCatalogCount ?? 0) >= discoverResult.withText) ||
      (importResult &&
        !importResult.error &&
        (importResult.imported > 0 || importResult.alreadyPresent > 0)),
  );

  $: catalogComplete = Boolean(
    graph.store !== "surreal" ||
      catalogImportSatisfied ||
      provenanceAudit?.verdict === "native" ||
      (linkSourcesOptions != null &&
        linkSourcesOptions.unitsNeedingLink === 0 &&
        !linkSourcesOptions.estimate &&
        linkSourcesOptions.candidateSources > 0),
  );

  $: ideasNeedingSourceLink =
    provenanceAudit?.verdict === "native"
      ? 0
      : (provenanceAudit?.needsEdgeRepair ?? linkSourcesOptions?.unitsNeedingLink ?? 0);

  $: linkReadinessComplete =
    catalogLinkStepComplete ||
    provenanceAudit?.verdict === "native" ||
    (provenanceAudit != null &&
      provenanceAudit.verdict !== "unknown" &&
      provenanceAudit.needsEdgeRepair === 0) ||
    (linkSourcesOptions != null &&
      linkSourcesOptions.unitsNeedingLink === 0 &&
      !linkSourcesOptions.estimate);

  $: embedReadinessComplete =
    readinessEmbedStepComplete ||
    (graph.stats != null &&
      graph.stats.units > 0 &&
      graph.stats.embedded >= graph.stats.units) ||
    (embedOptions != null && !embedOptions.health.actionNeeded);

  $: validateReadinessComplete = uncheckedCount === 0;

  $: graphReadinessComplete =
    catalogComplete && linkReadinessComplete && embedReadinessComplete && validateReadinessComplete;

  // Remediation unlocks as soon as ≥1 idea has been checked (a verdict exists).
  $: checkedCount = stats
    ? stats.validation.ok + stats.validation.weak + stats.validation.unsupported
    : 0;
  $: remediationUnlocked = checkedCount > 0;
  // Ideas "ready for remediation" — flagged (weak/unsupported) and not yet human-triaged.
  $: remediableCount = quarantineCount > 0 ? quarantineCount : unsupportedUntriagedCount;

  $: graphReadinessBlockers = (() => {
    const blockers: string[] = [];
    if (graph.store === "surreal" && !catalogComplete) {
      blockers.push("Import source text into the pipeline catalog.");
    }
    if (!linkReadinessComplete) blockers.push("Link ideas to source text.");
    if (!embedReadinessComplete) blockers.push("Embed all ideas at one vector dimension.");
    if (!validateReadinessComplete) {
      blockers.push("Validate unchecked ideas in the readiness wizard.");
    }
    return blockers;
  })();
  $: unsupportedUntriagedCount =
    stats?.validation.unsupported_untriaged ??
    revalidateOptions?.unsupportedUntriagedCount ??
    0;
  $: reviewedUnsupportedCount =
    stats != null
      ? Math.max(0, stats.validation.unsupported - unsupportedUntriagedCount)
      : 0;
  $: quarantineIncludesWeak =
    needsReviewCount > 0 && unsupportedUntriagedCount < needsReviewCount;

  const REVIEW_ACTIONS: { action: ReviewVerdictAction; label: string; key: string }[] = [
    { action: "ok", label: "Approve · supported", key: "A" },
    { action: "weak", label: "Mark weak", key: "W" },
    { action: "unsupported", label: "Mark unsupported", key: "U" },
  ];

  function normalizeClaimText(text: string): string {
    return text.trim().replace(/\s+/g, " ").toLowerCase();
  }

  function unitsMatchingGroup(group: Group, pool: Unit[]): Unit[] {
    if (group.members.length === 0) return [];
    const keys = new Set(group.members.map((m) => normalizeClaimText(m.text)));
    return pool.filter((u) => keys.has(normalizeClaimText(u.text)));
  }

  /** Supported claims are never in quarantine — verdict narrow unavailable there. */
  function verdictNarrowDisabled(verdict: VerdictFilter, scope: QueueScope): boolean {
    return scope === "review" && verdict === "ok";
  }

  function setQueueScope(next: QueueScope) {
    queueScope = next;
    if (verdictNarrowDisabled("ok", next) && verdictFilter === "ok") {
      verdictFilter = null;
    }
    // Evidence facets live on the whole graph — quarantine clears them.
    if (next === "review") verificationStateFilter = null;
    selectedId = null;
    queuePage = 0;
  }

  function toggleVerdictFilter(verdict: VerdictFilter) {
    if (verdictNarrowDisabled(verdict, queueScope)) return;
    verdictFilter = verdictFilter === verdict ? null : verdict;
    verificationStateFilter = null;
    selectedId = null;
    queuePage = 0;
  }

  function applyVerdictFilter(verdict: VerdictFilter) {
    workspaceMode = "triage";
    if (verdictNarrowDisabled(verdict, queueScope)) {
      queueScope = "all";
    }
    verdictFilter = verdict;
    verificationStateFilter = null;
    selectedId = null;
    queuePage = 0;
  }

  /** Evidence facet (W2.2): one state at a time; the URL carries one `filter` slot. */
  function toggleEvidenceFacet(state: VerificationState) {
    if (verificationStateFilter === state) {
      verificationStateFilter = null;
    } else {
      verificationStateFilter = state;
      queueScope = "all";
      verdictFilter = null;
    }
    selectedId = null;
    queuePage = 0;
  }

  function selectGroup(group: Group) {
    selectedGroupId = group.id;
  }

  function applyGroupToQueue(group: Group) {
    groupScopeId = group.id;
    workspaceMode = "triage";
    queueScope = "all";
    queuePage = 0;
    const matched = unitsMatchingGroup(group, units);
    selectedId = matched[0]?.id ?? null;
  }

  function clearGroupScope() {
    groupScopeId = null;
    queuePage = 0;
  }

  function formatRelationType(type: string): string {
    return type.replace(/_/g, " ");
  }

  function truncatePreview(text: string, max = 72): string {
    const t = text.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  async function loadClusterRelations(unitIds: string[]) {
    const gen = ++relationsFetchGen;
    if (unitIds.length === 0) {
      clusterRelations = [];
      clusterRelationsError = null;
      clusterRelationsTruncated = false;
      clusterRelationsLoading = false;
      return;
    }
    clusterRelationsLoading = true;
    clusterRelationsError = null;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/relations/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_ids: unitIds.slice(0, 80),
          domain_pack_id: graph.domainPackId ?? null,
          limit: 12,
        }),
      });
      if (gen !== relationsFetchGen) return;
      const body = (await res.json().catch(() => ({}))) as {
        relations?: RelationPreview[];
        truncated?: boolean;
        message?: string;
      };
      if (!res.ok) {
        clusterRelations = [];
        clusterRelationsTruncated = false;
        clusterRelationsError =
          typeof body.message === "string"
            ? body.message
            : `Could not load relations (HTTP ${res.status}).`;
        return;
      }
      clusterRelations = Array.isArray(body.relations) ? body.relations : [];
      clusterRelationsTruncated = Boolean(body.truncated);
    } catch {
      if (gen !== relationsFetchGen) return;
      clusterRelations = [];
      clusterRelationsTruncated = false;
      clusterRelationsError = "Network error while loading relations.";
    } finally {
      if (gen === relationsFetchGen) clusterRelationsLoading = false;
    }
  }

  function openUnitInTriage(unit: Unit) {
    workspaceMode = "triage";
    queueScope = "all";
    selectUnit(unit);
    const idx = filteredUnits.findIndex((u) => u.id === unit.id);
    if (idx >= 0 && filteredUnits.length > QUEUE_PAGE_SIZE) {
      queuePage = Math.floor(idx / QUEUE_PAGE_SIZE);
    }
  }

  $: scopedGroup = groupScopeId
    ? (graph.groups.find((g) => g.id === groupScopeId) ?? null)
    : null;

  $: unitsForQueue = scopedGroup ? unitsMatchingGroup(scopedGroup, units) : units;

  $: scopedUnits =
    queueScope === "all"
      ? unitsForQueue
      : unitsForQueue.filter((u) => isAwaitingHumanTriage(u.validationStatus, u.validationNote));

  $: verdictScopedUnits = verdictFilter
    ? scopedUnits.filter((u) => normalizeValidationStatus(u.validationStatus) === verdictFilter)
    : scopedUnits;

  // Evidence facet narrow (W2.2): exact verification-state match; pre-EBV units
  // (no claim-version row) match no facet — never silently bucketed.
  $: filteredUnits = verificationStateFilter
    ? verdictScopedUnits.filter((u) =>
        unitMatchesEvidenceFacet(u.evidence?.verificationState ?? null, verificationStateFilter!),
      )
    : verdictScopedUnits;

  // Facet chip counts: server breakdown plus optimistic action shifts.
  $: evidenceStateCounts = graph.evidenceStates
    ? VERIFICATION_STATES.reduce(
        (acc, s) => {
          acc[s] = Math.max(0, (graph.evidenceStates?.[s] ?? 0) + (evidenceDelta[s] ?? 0));
          return acc;
        },
        {} as Record<VerificationState, number>,
      )
    : null;
  $: evidenceTrackedTotal = evidenceStateCounts
    ? VERIFICATION_STATES.reduce((sum, s) => sum + evidenceStateCounts[s], 0)
    : 0;
  /** Ideas with no EBV row at all — surfaced honestly, never bucketed into a state. */
  $: preEvidenceCount =
    evidenceStateCounts && stats ? Math.max(0, stats.units - evidenceTrackedTotal) : 0;

  $: filteredGroups = graph.groups.filter((g) => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return true;
    if (g.name.toLowerCase().includes(q)) return true;
    if (g.summary?.toLowerCase().includes(q)) return true;
    return g.members.some((m) => m.text.toLowerCase().includes(q));
  });

  $: {
    if (workspaceMode === "clusters" && graph.groups.length > 0) {
      if (!selectedGroupId || !graph.groups.some((g) => g.id === selectedGroupId)) {
        selectedGroupId = filteredGroups[0]?.id ?? graph.groups[0].id;
      }
    }
  }

  $: selectedGroup =
    selectedGroupId != null
      ? (graph.groups.find((g) => g.id === selectedGroupId) ?? null)
      : null;

  $: selectedGroupUnits = selectedGroup ? unitsMatchingGroup(selectedGroup, units) : [];

  $: clusterRelationUnitKey = selectedGroupUnits
    .map((u) => u.id)
    .sort()
    .join("|");

  $: if (workspaceMode === "clusters" && clusterRelationUnitKey) {
    void loadClusterRelations(selectedGroupUnits.map((u) => u.id));
  } else if (workspaceMode !== "clusters") {
    relationsFetchGen += 1;
    clusterRelations = [];
    clusterRelationsLoading = false;
    clusterRelationsError = null;
    clusterRelationsTruncated = false;
  }

  $: queuePageCount = Math.max(1, Math.ceil(filteredUnits.length / QUEUE_PAGE_SIZE));
  /** Clamped page index for display/slicing — do not assign back to queuePage (avoids reactive cycle). */
  $: queuePageSafe = Math.min(queuePage, Math.max(0, queuePageCount - 1));
  $: if (queuePage > queuePageCount - 1) {
    queuePage = Math.max(0, queuePageCount - 1);
  }

  $: paginatedUnits =
    filteredUnits.length > QUEUE_PAGE_SIZE
      ? filteredUnits.slice(
          queuePageSafe * QUEUE_PAGE_SIZE,
          (queuePageSafe + 1) * QUEUE_PAGE_SIZE,
        )
      : filteredUnits;

  $: selectedQueueIndex = selectedId ? filteredUnits.findIndex((u) => u.id === selectedId) : -1;
  $: selectedOffPage =
    selectedQueueIndex >= 0 &&
    filteredUnits.length > QUEUE_PAGE_SIZE &&
    (selectedQueueIndex < queuePageSafe * QUEUE_PAGE_SIZE ||
      selectedQueueIndex >= (queuePageSafe + 1) * QUEUE_PAGE_SIZE);
  $: selectedPageIndex =
    selectedQueueIndex >= 0 ? Math.floor(selectedQueueIndex / QUEUE_PAGE_SIZE) : null;

  $: {
    if (filteredUnits.length === 0) {
      selectedId = null;
    } else if (!selectedId || !filteredUnits.some((u) => u.id === selectedId)) {
      selectedId = filteredUnits[0].id;
    }
  }

  $: selectedUnit = selectedId ? units.find((u) => u.id === selectedId) ?? null : null;
  $: reviewGuidance = selectedUnit
    ? graphReviewGuidance(selectedUnit.validationStatus, selectedUnit.validationNote)
    : null;
  $: reviewCoaching =
    selectedUnit?.id && reviewCoachingCache[selectedUnit.id]
      ? reviewCoachingCache[selectedUnit.id]
      : null;

  $: if (selectedUnit?.id !== reviewCoachingUnitId) {
    reviewCoachingOpen = false;
    reviewCoachingLoading = false;
    reviewCoachingError = null;
    reviewCoachingUnitId = selectedUnit?.id ?? null;
  }

  // ── Evidence Dossier loading (W2.2) ─────────────────────────────────────
  // Fetch the dossier (excerpt + custody + versions) when a claim with EBV data
  // is selected; pre-EBV claims render the honest static block without a fetch.
  $: if (selectedUnit?.id !== dossierUnitId) {
    dossierUnitId = selectedUnit?.id ?? null;
    dossierError = null;
    evidenceActionError = null;
    if (selectedUnit && !predatesEvidenceBinding(selectedUnit.evidence ?? null)) {
      if (!dossierCache[selectedUnit.id]) void loadDossier(selectedUnit);
    }
  }

  $: selectedDossier = selectedUnit ? (dossierCache[selectedUnit.id] ?? null) : null;
  $: selectedRecheck = selectedUnit ? (recheckOutcomes[selectedUnit.id] ?? null) : null;
  $: selectedStampVisual = verificationStampVisual(
    selectedUnit?.evidence?.verificationState ?? null,
  );
  $: selectedAcceptGuard = canAcceptAsSupported(selectedUnit?.evidence ?? null);

  async function loadDossier(unit: Unit, force = false) {
    if (dossierLoading) return;
    if (!force && dossierCache[unit.id]) return;
    dossierLoading = true;
    dossierError = null;
    const requestedId = unit.id;
    try {
      const params = new URLSearchParams();
      if (graph.domainPackId) params.set("domain_pack_id", graph.domainPackId);
      const qs = params.toString();
      const res = await fetch(
        `${CONNECT_PIPELINE_API}/graph/units/${encodeURIComponent(unit.id)}/evidence${qs ? `?${qs}` : ""}`,
        { credentials: "include" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.dossier) {
        if (dossierUnitId === requestedId) {
          dossierError =
            typeof body.message === "string"
              ? body.message
              : `Could not load the evidence dossier (HTTP ${res.status}).`;
        }
        return;
      }
      dossierCache = { ...dossierCache, [requestedId]: body.dossier as ConnectEvidenceDossier };
    } catch {
      if (dossierUnitId === requestedId) {
        dossierError = "Network error while loading the evidence dossier.";
      }
    } finally {
      dossierLoading = false;
    }
  }

  /** Deterministic Layer-1 re-check (no model keys) — honest pass/fail inline. */
  async function runEvidenceRecheck(unit: Unit) {
    if (recheckBusy) return;
    recheckBusy = true;
    evidenceActionError = null;
    try {
      const res = await fetch(
        `${CONNECT_PIPELINE_API}/graph/units/${encodeURIComponent(unit.id)}/evidence`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "recheck", domain_pack_id: graph.domainPackId ?? null }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.outcome) {
        evidenceActionError =
          typeof body.message === "string"
            ? body.message
            : `Re-check failed to run (HTTP ${res.status}).`;
        return;
      }
      recheckOutcomes = { ...recheckOutcomes, [unit.id]: body.outcome as RecheckOutcome };
    } catch {
      evidenceActionError = "Network error while running the re-check.";
    } finally {
      recheckBusy = false;
    }
  }

  function shiftEvidenceDelta(
    from: VerificationState | null,
    to: VerificationState,
  ): Partial<Record<VerificationState, number>> {
    const next = { ...evidenceDelta };
    if (from) next[from] = (next[from] ?? 0) - 1;
    next[to] = (next[to] ?? 0) + 1;
    return next;
  }

  /** Accept → supported. Server re-checks the row-2 guard; UI never offers it unbound. */
  async function performEvidenceAccept(unit: Unit) {
    if (evidenceActionBusy || !unit.evidence) return;
    const guard = canAcceptAsSupported(unit.evidence);
    if (!guard.ok) {
      evidenceActionError = guard.reason;
      return;
    }
    evidenceActionBusy = true;
    evidenceActionError = null;
    const prevState = unit.evidence.verificationState;
    const snapshot = { unitOverrides, evidenceDelta: { ...evidenceDelta } };
    unitOverrides = {
      ...unitOverrides,
      [unit.id]: {
        ...unitOverrides[unit.id],
        evidence: { ...unit.evidence, verificationState: "supported" },
      },
    };
    evidenceDelta = shiftEvidenceDelta(prevState, "supported");
    try {
      const res = await fetch(
        `${CONNECT_PIPELINE_API}/graph/units/${encodeURIComponent(unit.id)}/evidence`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept", domain_pack_id: graph.domainPackId ?? null }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        unitOverrides = snapshot.unitOverrides;
        evidenceDelta = snapshot.evidenceDelta;
        evidenceActionError =
          typeof body.message === "string" ? body.message : `Accept failed (HTTP ${res.status}).`;
      }
    } catch {
      unitOverrides = snapshot.unitOverrides;
      evidenceDelta = snapshot.evidenceDelta;
      evidenceActionError = "Network error while accepting this claim.";
    } finally {
      evidenceActionBusy = false;
    }
  }

  /** Reversible soft-exclude (never hard-delete) — confirmed, optimistic, rollback. */
  async function performEvidenceExclude(unit: Unit) {
    if (evidenceActionBusy || !unit.evidence) return;
    const preview = unit.text.length > 120 ? `${unit.text.slice(0, 120)}…` : unit.text;
    if (
      !confirm(
        `Exclude this claim from retrieval?\n\n"${preview}"\n\nIt stays on the record (soft-exclude, reversible by re-validation) but agents will no longer retrieve it.`,
      )
    ) {
      return;
    }
    evidenceActionBusy = true;
    evidenceActionError = null;
    const prevState = unit.evidence.verificationState;
    const snapshot = { unitOverrides, evidenceDelta: { ...evidenceDelta } };
    unitOverrides = {
      ...unitOverrides,
      [unit.id]: {
        ...unitOverrides[unit.id],
        evidence: { ...unit.evidence, verificationState: "excluded" },
        validationStatus: "removed",
      },
    };
    evidenceDelta = shiftEvidenceDelta(prevState, "excluded");
    try {
      const res = await fetch(
        `${CONNECT_PIPELINE_API}/graph/units/${encodeURIComponent(unit.id)}/evidence`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "exclude",
            note: reviewNote.trim() || null,
            domain_pack_id: graph.domainPackId ?? null,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        unitOverrides = snapshot.unitOverrides;
        evidenceDelta = snapshot.evidenceDelta;
        evidenceActionError =
          typeof body.message === "string" ? body.message : `Exclude failed (HTTP ${res.status}).`;
      }
    } catch {
      unitOverrides = snapshot.unitOverrides;
      evidenceDelta = snapshot.evidenceDelta;
      evidenceActionError = "Network error while excluding this claim.";
    } finally {
      evidenceActionBusy = false;
    }
  }

  function fmtDossierDate(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  /** The "validated" date for the stamp ring: judge date, else state date, else bound date. */
  function stampRingDate(summary: UnitEvidenceSummary | null | undefined): string | null {
    if (!summary) return null;
    return (
      fmtDossierDate(summary.judge?.judgedAt) ??
      fmtDossierDate(summary.judgedAt) ??
      fmtDossierDate(summary.boundAt)
    );
  }

  async function loadReviewCoaching(unit: Unit, force = false) {
    if (!force && reviewCoachingCache[unit.id]) return;
    reviewCoachingLoading = true;
    reviewCoachingError = null;
    try {
      const res = await fetch(
        `${CONNECT_PIPELINE_API}/graph/units/${encodeURIComponent(unit.id)}/review-coaching`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: unit.text,
            validation_status: unit.validationStatus,
            validation_note: unit.validationNote,
            unit_type: unit.unitType,
            source_title: unit.sourceTitle,
            source_url: unit.sourceUrl,
            source_kind: unit.sourceKind,
            domain_pack_id: graph.domainPackId ?? null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.coaching) {
        reviewCoachingError =
          typeof data.message === "string"
            ? data.message
            : `Could not load review coaching (HTTP ${res.status}).`;
        return;
      }
      reviewCoachingCache = { ...reviewCoachingCache, [unit.id]: data.coaching as GraphReviewCoaching };
    } catch {
      reviewCoachingError = "Network error while loading review coaching.";
    } finally {
      reviewCoachingLoading = false;
    }
  }

  function onReviewCoachingToggle(event: Event) {
    const details = event.currentTarget as HTMLDetailsElement;
    reviewCoachingOpen = details.open;
    if (!details.open || !selectedUnit) return;
    void loadReviewCoaching(selectedUnit);
  }

  function statusLabel(status: string | null): string {
    if (status === "ok") return "Supported";
    if (status === "weak") return "Weak";
    if (status === "unsupported") return "Unsupported";
    return "Unchecked";
  }

  function badgeVariant(status: string | null): "neon" | "blue" | "coral" | "canvas" {
    if (status === "ok") return "blue";
    if (status === "weak") return "neon";
    if (status === "unsupported") return "coral";
    return "canvas";
  }

  function hasProvenance(unit: Unit): boolean {
    return Boolean(unit.author || unit.sourceTitle || unit.sourceUrl || unit.sourceKind);
  }

  function sourceKindLabel(kind: string | null): string | null {
    if (!kind) return null;
    if (kind === "url") return "URL";
    if (kind === "text") return "Text";
    if (kind === "upload") return "Upload";
    return kind.replace(/_/g, " ");
  }

  function selectUnit(unit: Unit) {
    selectedId = unit.id;
    reviewNote = "";
    actionError = null;
  }

  function statBucket(status: string | null): keyof Stats["validation"] {
    if (status === "ok") return "ok";
    if (status === "weak") return "weak";
    if (status === "unsupported") return "unsupported";
    return "unvalidated";
  }

  function shiftTriageDelta(delta: StatsDelta, unit: Unit): StatsDelta {
    if (!isAwaitingHumanTriage(unit.validationStatus, unit.validationNote)) return delta;
    const next = { ...delta, awaiting_triage: delta.awaiting_triage - 1 };
    if (normalizeValidationStatus(unit.validationStatus) === "unsupported") {
      next.unsupported_untriaged = delta.unsupported_untriaged - 1;
    }
    return next;
  }

  function nextQueueUnitId(currentId: string): string | null {
    const idx = filteredUnits.findIndex((u) => u.id === currentId);
    if (idx < 0) return filteredUnits[0]?.id ?? null;
    if (idx < filteredUnits.length - 1) return filteredUnits[idx + 1].id;
    if (idx > 0) return filteredUnits[idx - 1].id;
    return null;
  }

  function previousQueueUnitId(currentId: string): string | null {
    const idx = filteredUnits.findIndex((u) => u.id === currentId);
    if (idx <= 0) return null;
    return filteredUnits[idx - 1].id;
  }

  function flashReviewButton(action: ReviewVerdictAction) {
    flashingReviewAction = action;
    window.setTimeout(() => {
      flashingReviewAction = null;
    }, 100);
  }

  function isReviewShortcutTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return true;
    return target.isContentEditable;
  }

  /**
   * R6 mobile read-only tier: the dashboard layout renders the shell with
   * `data-mobile-readonly="true"` on a phone-sized read-only surface and hides
   * the mutation chrome with CSS. CSS can't stop the verdict keyboard shortcuts
   * (a/w/u → performReview, a PATCH), so we guard them here: if a read-only shell
   * is in the DOM, the mutating shortcuts early-return. Read-only navigation keys
   * (n/p/arrows) are unaffected — they're handled below this guard.
   */
  function isMobileReadonlyActive(): boolean {
    if (typeof document === "undefined") return false;
    return document.querySelector('[data-mobile-readonly="true"]') !== null;
  }

  function handleReviewKeydown(event: KeyboardEvent) {
    // W4.2 — while the Stamping Desk overlay is open it owns the keyboard
    // (its own window listener handles j/k/s/x/w/e/n/z/?/Esc). Defer entirely
    // so the explorer's a/w/u/n/p bindings never double-fire underneath it.
    if (deskActive) return;
    if (!reviewEnabled || !selectedUnit || isReviewShortcutTarget(event.target)) return;

    const mobileReadonly = isMobileReadonlyActive();

    const key = event.key;
    if (key === "a" || key === "A") {
      if (mobileReadonly) return;
      if (asOfActive) return; // W2.5: editing past state is not possible.
      event.preventDefault();
      void performReview(selectedUnit, "ok");
      return;
    }
    if (key === "w" || key === "W") {
      if (mobileReadonly) return;
      if (asOfActive) return; // W2.5: editing past state is not possible.
      event.preventDefault();
      void performReview(selectedUnit, "weak");
      return;
    }
    if (key === "u" || key === "U") {
      if (mobileReadonly) return;
      if (asOfActive) return; // W2.5: editing past state is not possible.
      event.preventDefault();
      void performReview(selectedUnit, "unsupported");
      return;
    }
    if (key === "ArrowRight" || key === "n" || key === "N") {
      event.preventDefault();
      const nextId = nextQueueUnitId(selectedUnit.id);
      const nextUnit = nextId ? units.find((u) => u.id === nextId) : null;
      if (nextUnit) selectUnit(nextUnit);
      return;
    }
    if (key === "ArrowLeft" || key === "p" || key === "P") {
      event.preventDefault();
      const prevId = previousQueueUnitId(selectedUnit.id);
      const prevUnit = prevId ? units.find((u) => u.id === prevId) : null;
      if (prevUnit) selectUnit(prevUnit);
    }
  }

  function shiftStatsDelta(
    delta: StatsDelta,
    oldStatus: string | null,
    newStatus: string | null,
  ): StatsDelta {
    const next = { ...delta };
    if (oldStatus != null) {
      const oldKey = statBucket(oldStatus);
      next[oldKey] -= 1;
    }
    if (newStatus != null) {
      const newKey = statBucket(newStatus);
      next[newKey] += 1;
    }
    return next;
  }

  function hideUnitOptimistically(unit: Unit) {
    removedIds = { ...removedIds, [unit.id]: true };
    statsDelta = shiftTriageDelta(
      {
        ...shiftStatsDelta(statsDelta, unit.validationStatus, null),
        units: statsDelta.units - 1,
      },
      unit,
    );
    if (selectedId === unit.id) {
      reviewNote = "";
    }
  }

  function applyReviewOptimistically(
    unit: Unit,
    status: "ok" | "weak" | "unsupported",
    note: string | null,
  ) {
    const humanNote = formatHumanReviewNote(status, note);
    unitOverrides = {
      ...unitOverrides,
      [unit.id]: { validationStatus: status, validationNote: humanNote },
    };
    statsDelta = shiftTriageDelta(shiftStatsDelta(statsDelta, unit.validationStatus, status), unit);
    reviewNote = "";
  }

  function revertReviewOptimistic(
    unit: Unit,
    snapshot: {
      unitOverrides: typeof unitOverrides;
      statsDelta: StatsDelta;
      reviewNote: string;
    },
  ) {
    unitOverrides = snapshot.unitOverrides;
    statsDelta = snapshot.statsDelta;
    reviewNote = snapshot.reviewNote;
    if (selectedId !== unit.id) {
      selectedId = unit.id;
    }
  }

  function revertRemoveOptimistic(snapshot: {
    removedIds: typeof removedIds;
    statsDelta: StatsDelta;
  }) {
    removedIds = snapshot.removedIds;
    statsDelta = snapshot.statsDelta;
  }

  /**
   * Result of attempting a verdict. The desk needs the truth, not a silent
   * early-return: `dispatched` means the stamp is now server-bound (it WILL
   * PATCH once the 250ms advance animation completes); `swallowed` means a
   * previous stamp is still in flight (the 250ms `exitingUnitId` guard window)
   * and this input was refused — the caller must hold, not advance/tally;
   * `disabled` means review is off entirely.
   */
  type ReviewDispatch = "dispatched" | "swallowed" | "disabled";

  /**
   * @param onResolved Optional continuation fired AFTER the server responds with
   *   `ok` (true = persisted, false = rejected/network-failed and the optimistic
   *   apply was reverted). The desk uses this to roll back its tally/undo state
   *   when a stamp does not actually save — so the rail never counts a phantom.
   */
  function performReview(
    unit: Unit,
    status: ReviewVerdictAction,
    onResolved?: (ok: boolean) => void,
  ): ReviewDispatch {
    if (!reviewEnabled) return "disabled";
    if (exitingUnitId) return "swallowed";
    const nextId = nextQueueUnitId(unit.id);
    flashReviewButton(status);
    exitingUnitId = unit.id;
    window.setTimeout(() => {
      submitReview(unit, status, onResolved);
      exitingUnitId = null;
      if (nextId) selectedId = nextId;
    }, 250);
    return "dispatched";
  }

  // ── Stamping Desk (W4.2) wiring — reuses performReview/selectUnit, no new fetch ─
  /**
   * True when the desk must be read-only. This drives the desk's `readonly` prop
   * and the visible chrome (the entry-button copy, the in-desk read-only note).
   *
   * SECURITY (MAJOR-1): the mobile read-only tier is checked at CALL time, NOT
   * here. The layout sets `data-mobile-readonly="true"` in its `onMount` (after a
   * matchMedia probe), which lands AFTER this component first evaluates its
   * reactive statements — so a reactive flag that read `isMobileReadonlyActive()`
   * once would compute `false` on a phone and never recompute (its only tracked
   * dep would be `asOfActive`). The button still mutated. So:
   *   - this reactive value tracks only `asOfActive` (which IS reactive + correct);
   *   - the mobile tier hides the entry button + desk via CSS (`.shell-mobile-readonly`);
   *   - and EVERY mutation entry point (`enterDesk`, `deskStamp`, `deskUndo`) and
   *     the desk-open keydown re-check `deskMutationBlocked()` at call time, which
   *     queries the live DOM flag and refuses honestly.
   */
  $: deskReadonly = asOfActive;
  /**
   * Call-time read-only guard for any desk MUTATION. Evaluated at the moment of
   * the click/keypress so the mobile read-only flag — set by the layout after
   * mount — is always observed (see the MAJOR-1 note above). Mirrors the pattern
   * `handleReviewKeydown` already uses for the a/w/u shortcuts.
   */
  function deskMutationBlocked(): boolean {
    return asOfActive || isMobileReadonlyActive();
  }
  /** Position (1-based) + total of the selected claim in the live filtered queue. */
  $: deskPosition = selectedQueueIndex >= 0 ? selectedQueueIndex + 1 : 0;
  /** Claims still awaiting a verdict in the loaded queue (drives "N remaining"). */
  $: deskRemaining = filteredUnits.filter((u) =>
    isAwaitingHumanTriage(u.validationStatus, u.validationNote),
  ).length;

  function enterDesk() {
    // Call-time guard (MAJOR-1): re-check the mobile read-only tier on click, not
    // just the reactive as-of flag — the entry button can exist in the DOM on a
    // phone before the layout's mount-time flag hides it, so refuse honestly here.
    if (!reviewEnabled || deskMutationBlocked()) return;
    // Reset the per-visit tally and undo history, then open. If nothing is
    // selected, land on the first claim so the keyboard loop has a target.
    deskTally = emptyDeskTally();
    deskLastStamp = null;
    if (!selectedUnit && filteredUnits[0]) selectUnit(filteredUnits[0]);
    deskActive = true;
    void deskComponent?.focusClaim();
  }

  function exitDesk() {
    deskActive = false;
  }

  /**
   * Stamp the current claim from the desk — records prior verdict for undo.
   *
   * MAJOR-2 (truthful tally): we tally / announce-success / record-undo-state
   * ONLY when `performReview` confirms a server-bound dispatch. If a previous
   * stamp is still inside the 250ms guard window the call is `swallowed` — we
   * hold and tell the operator, rather than counting a stamp the server will
   * never see and then advancing. If the server later rejects the stamp, the
   * `onResolved(false)` continuation rolls the tally + undo state back.
   */
  function deskStamp(status: ReviewVerdictAction) {
    // MAJOR-1: re-check the mobile read-only tier at call time.
    if (!selectedUnit || deskMutationBlocked()) return;
    const unit = selectedUnit;
    const priorStatus = normalizeValidationStatus(unit.validationStatus);
    const fromStatus =
      priorStatus === "ok" || priorStatus === "weak" || priorStatus === "unsupported"
        ? priorStatus
        : null;

    const dispatch = performReview(unit, status, (ok) => {
      if (ok) return;
      // Server rejected (or network failed) — `submitReview` already reverted the
      // optimistic graph state; undo our optimistic tally + undo record so the
      // rail and the Z affordance match the server. Guard against clobbering a
      // newer stamp that may have landed in the meantime.
      deskTally = tallyUndo(deskTally, status);
      if (deskLastStamp && deskLastStamp.unitId === unit.id && deskLastStamp.toStatus === status) {
        deskLastStamp = null;
      }
      deskComponent?.announce("That stamp didn't save — it's been rolled back. Try again.");
    });

    if (dispatch !== "dispatched") {
      deskComponent?.announce(
        dispatch === "swallowed"
          ? "Hold on — saving the previous stamp. Try that again in a moment."
          : "Stamping is unavailable right now.",
      );
      void deskComponent?.focusClaim();
      return;
    }

    // Confirmed server-bound: NOW it is honest to count it and arm undo.
    deskLastStamp = { unitId: unit.id, toStatus: status, fromStatus };
    deskTally = tallyStamp(deskTally, status);
    deskComponent?.announce(announceStamp(status, Math.max(0, deskRemaining - 1)));
    void deskComponent?.focusClaim();
  }

  /**
   * Re-stamp the last claim to its prior verdict (honest undo — no server unstamp).
   *
   * MAJOR-2: only flip the tally / clear the undo record once the re-stamp is a
   * confirmed dispatch. An S→Z inside the 250ms window is `swallowed`: we keep the
   * undo affordance armed and tell the operator to wait, instead of announcing
   * "Undone" while the server still holds the original verdict.
   */
  function deskUndo(toStatus: ReviewVerdictAction) {
    const last = deskLastStamp;
    // MAJOR-1: re-check the mobile read-only tier at call time.
    if (!last || deskMutationBlocked()) return;
    const unit = units.find((u) => u.id === last.unitId);
    if (!unit) {
      deskComponent?.announce("Could not restore — the claim left the loaded queue.");
      void deskComponent?.focusClaim();
      return;
    }
    selectUnit(unit);
    const undoneStatus = last.toStatus;

    const dispatch = performReview(unit, toStatus, (ok) => {
      if (ok) return;
      // The re-stamp didn't persist — restore the tally + undo affordance. Guard
      // against clobbering a NEWER undo record: if another stamp landed while this
      // undo's PATCH was in flight, its record wins (mirrors deskStamp's rollback).
      deskTally = tallyStamp(deskTally, undoneStatus);
      if (deskLastStamp == null) {
        deskLastStamp = last;
      }
      deskComponent?.announce("Undo didn't save — restored the stamp. Try again.");
    });

    if (dispatch !== "dispatched") {
      deskComponent?.announce(
        dispatch === "swallowed"
          ? "Hold on — saving the previous stamp. Try undo again in a moment."
          : "Undo is unavailable right now.",
      );
      void deskComponent?.focusClaim();
      return;
    }

    deskTally = tallyUndo(deskTally, undoneStatus);
    deskLastStamp = null;
    deskComponent?.announce(`Undone. Restored to ${toStatus}.`);
    void deskComponent?.focusClaim();
  }

  function deskAdvance() {
    if (!selectedUnit) return;
    const nextId = nextQueueUnitId(selectedUnit.id);
    const next = nextId ? units.find((u) => u.id === nextId) : null;
    if (next) selectUnit(next);
    void deskComponent?.focusClaim();
  }

  function deskRetreat() {
    if (!selectedUnit) return;
    const prevId = previousQueueUnitId(selectedUnit.id);
    const prev = prevId ? units.find((u) => u.id === prevId) : null;
    if (prev) selectUnit(prev);
    void deskComponent?.focusClaim();
  }

  /**
   * E — reveal the evidence dossier. The dossier auto-loads on selection (the
   * reactive above), so this only needs to ensure it is fetched and bring the
   * panel into view below the desk overlay.
   */
  function deskOpenEvidence() {
    if (!selectedUnit) return;
    if (!predatesEvidenceBinding(selectedUnit.evidence ?? null) && !dossierCache[selectedUnit.id]) {
      void loadDossier(selectedUnit);
    }
    if (typeof document !== "undefined") {
      document.querySelector(".detail-panel .dossier")?.scrollIntoView({ block: "nearest" });
    }
  }

  function submitReview(
    unit: Unit,
    status: "ok" | "weak" | "unsupported",
    onResolved?: (ok: boolean) => void,
  ) {
    if (!reviewEnabled) {
      onResolved?.(false);
      return;
    }
    actionError = null;
    const note = reviewNote.trim() || null;
    const snapshot = {
      unitOverrides,
      statsDelta: { ...statsDelta },
      reviewNote,
    };
    applyReviewOptimistically(unit, status, note);

    void fetch(
      `${CONNECT_PIPELINE_API}/graph/units/${encodeURIComponent(unit.id)}/validation`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          note,
          domain_pack_id: graph.domainPackId ?? null,
        }),
      },
    )
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          revertReviewOptimistic(unit, snapshot);
          actionError = body.message ?? `Review failed (HTTP ${res.status}).`;
          onResolved?.(false);
          return;
        }
        onResolved?.(true);
      })
      .catch(() => {
        revertReviewOptimistic(unit, snapshot);
        actionError = "Network error while saving your review.";
        onResolved?.(false);
      });
  }

  function removeFromGraph(unit: Unit) {
    if (!reviewEnabled) return;
    const preview = unit.text.length > 120 ? `${unit.text.slice(0, 120)}…` : unit.text;
    if (
      !confirm(
        `Remove this idea from your graph?\n\n"${preview}"\n\nIt will no longer appear in retrieval. This cannot be undone.`,
      )
    ) {
      return;
    }
    actionError = null;
    const snapshot = {
      removedIds: { ...removedIds },
      statsDelta: { ...statsDelta },
    };
    const nextId = nextQueueUnitId(unit.id);
    exitingUnitId = unit.id;
    window.setTimeout(() => {
      hideUnitOptimistically(unit);
      exitingUnitId = null;
      if (nextId) selectedId = nextId;

      void fetch(
        `${CONNECT_PIPELINE_API}/graph/units/${encodeURIComponent(unit.id)}/validation`,
        { method: "DELETE" },
      )
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            revertRemoveOptimistic(snapshot);
            actionError = body.message ?? `Could not remove (HTTP ${res.status}).`;
          }
        })
        .catch(() => {
          revertRemoveOptimistic(snapshot);
          actionError = "Network error while removing this idea.";
        });
    }, 250);
  }

  async function startSourceLinking() {
    if (linkingSources) return;
    if (!linkSourcesOptions) {
      linkSourcesError =
        "Source linking options are still loading. Wait a moment and try again, or refresh the page.";
      return;
    }
    if (!linkSourcesOptions.enabled) {
      linkSourcesError =
        linkSourcesOptions.candidateSources === 0
          ? "No source text in the catalog yet — scan and import sources in the readiness wizard first."
          : "No ideas need linking for the current scope. Try scope “All ideas” if you want to re-match everything.";
      return;
    }
    linkSourcesError = null;
    linkingSources = true;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/link-sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: linkSourcesScope,
          ...(graph.domainPackId ? { domain_pack_id: graph.domainPackId } : {}),
          ...(activeRunId ? { cohort_run_id: activeRunId } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof body.message === "string"
            ? body.message
            : typeof body.error === "string"
              ? body.error.replace(/_/g, " ")
              : `Could not start source linking (HTTP ${res.status}).`;
        linkSourcesError = msg;
        return;
      }
      const jobId = body.job?.id;
      if (!jobId) {
        linkSourcesError = "Source linking started but no job id was returned.";
        return;
      }
      catalogLinkStepComplete = true;
      await goto(`${RUNS_HREF}/${jobId}?from=graph&task=link-sources`);
    } catch {
      linkSourcesError = "Network error while starting source linking.";
    } finally {
      linkingSources = false;
    }
  }

  function defaultPassageTextField(mapping: PackMappingFields): string {
    if (!mapping.passage_table?.trim()) return mapping.passage_text_field ?? "";
    return mapping.passage_text_field?.trim() || "text";
  }

  function applyMappingToForm(mapping: PackMappingFields) {
    packMappingForm = {
      source_table: mapping.source_table,
      passage_table: mapping.passage_table,
      source_text_field: mapping.source_text_field ?? "",
      passage_text_field: defaultPassageTextField(mapping),
      passage_source_field: mapping.passage_source_field ?? "",
    };
  }

  function applySuggestionToForm() {
    const suggested = discoverResult?.packSuggestion?.suggested;
    if (suggested) applyMappingToForm(suggested);
  }

  function syncPackMetaFromDiscover(data: DiscoverResult) {
    if (data.packTitle) packMappingTitle = data.packTitle;
    if (typeof data.packEditable === "boolean") packMappingEditable = data.packEditable;
    if (data.currentMapping) applyMappingToForm(data.currentMapping);
  }

  async function ensurePackMappingLoaded() {
    const packId = graph.domainPackId;
    if (!packId || packMappingLoaded || packMappingLoading) return;
    packMappingLoading = true;
    packMappingLoadError = null;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/domain-packs/${encodeURIComponent(packId)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        packMappingLoadError =
          typeof data.message === "string" ? data.message : "Could not load domain pack mapping.";
        return;
      }
      const pack = data.pack as {
        title?: string;
        is_builtin?: boolean;
        graph_schema?: PackMappingFields & { unit_table?: string };
      };
      if (pack?.title) packMappingTitle = pack.title;
      packMappingEditable = !pack?.is_builtin;
      if (pack?.graph_schema) {
        applyMappingToForm({
          source_table: pack.graph_schema.source_table ?? "source",
          passage_table: pack.graph_schema.passage_table ?? "passage",
          source_text_field: pack.graph_schema.source_text_field ?? "",
          passage_text_field: pack.graph_schema.passage_text_field ?? "",
          passage_source_field: pack.graph_schema.passage_source_field ?? "",
        });
      }
      packMappingLoaded = true;
    } catch {
      packMappingLoadError = "Network error while loading domain pack mapping.";
    } finally {
      packMappingLoading = false;
    }
  }

  async function savePackMappingAndRescan() {
    const packId =
      discoverResult?.domainPackId ?? discoverResult?.packSuggestion?.packId ?? graph.domainPackId;
    if (!packId || savingMapping) return;
    savingMapping = true;
    saveMappingError = null;
    discoveringError = null;
    try {
      const mapping: PackMappingFields = {
        source_table: packMappingForm.source_table.trim(),
        passage_table: packMappingForm.passage_table.trim(),
      };
      const sourceTextField = packMappingForm.source_text_field?.trim();
      const passageTextField = packMappingForm.passage_text_field?.trim();
      const passageSourceField = packMappingForm.passage_source_field?.trim();
      if (sourceTextField) mapping.source_text_field = sourceTextField;
      if (passageTextField) mapping.passage_text_field = passageTextField;
      if (passageSourceField) mapping.passage_source_field = passageSourceField;

      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/sources`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_pack_id: packId, mapping }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        saveMappingError = data.message ?? `Could not save mapping (HTTP ${res.status}).`;
        return;
      }
      discoverResult = data as DiscoverResult;
      syncPackMetaFromDiscover(discoverResult);
      syncPackError = null;
    } catch {
      saveMappingError = "Network error while saving domain pack mapping.";
    } finally {
      savingMapping = false;
    }
  }

  $: if (graph.reviewEnabled && graph.stats?.units && graph.domainPackId) {
    void ensurePackMappingLoaded();
  }

  async function discoverSources(opts?: { autoSyncPack?: boolean }) {
    if (discoveringLoading) return;
    discoveringLoading = true;
    discoveringError = null;
    syncPackError = null;
    try {
      const params = new URLSearchParams();
      if (graph.domainPackId) params.set("domain_pack_id", graph.domainPackId);
      if (opts?.autoSyncPack) params.set("auto_sync_pack", "1");
      const qs = params.toString();
      const res = await fetch(
        `${CONNECT_PIPELINE_API}/graph/sources${qs ? `?${qs}` : ""}`,
        { credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        discoveringError = data.message ?? `Could not scan graph sources (HTTP ${res.status}).`;
        return;
      }
      discoverResult = data as DiscoverResult;
      syncPackMetaFromDiscover(discoverResult);
      packMappingLoaded = true;
      if ((data as DiscoverResult).withText === 0) importResult = null;
    } catch {
      discoveringError = "Network error while scanning graph sources.";
    } finally {
      discoveringLoading = false;
    }
  }

  async function syncPackFromScan() {
    const packId = discoverResult?.domainPackId ?? discoverResult?.packSuggestion?.packId ?? graph.domainPackId;
    if (!packId || syncingPack) return;
    syncingPack = true;
    syncPackError = null;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/sources`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_pack_id: packId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        syncPackError = data.message ?? `Could not update domain pack (HTTP ${res.status}).`;
        return;
      }
      discoverResult = data as DiscoverResult;
      syncPackMetaFromDiscover(discoverResult);
    } catch {
      syncPackError = "Network error while updating the domain pack.";
    } finally {
      syncingPack = false;
    }
  }

  async function importSources() {
    if (importingLoading) return;
    importingLoading = true;
    importError = null;
    try {
      const packId =
        discoverResult?.domainPackId ?? discoverResult?.packSuggestion?.packId ?? graph.domainPackId;
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/sources`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packId ? { domain_pack_id: packId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        importError = data.message ?? `Import failed (HTTP ${res.status}).`;
        return;
      }
      importResult = data as ImportResult;
      if (importResult.error && importResult.message) {
        importError = importResult.message;
      }
      await discoverSources({ autoSyncPack: false });
      // Refresh link-sources options so the wizard can advance to the link step
      linkSourcesOptionsLoading = true;
      try {
        const optRes = await fetch(`${CONNECT_PIPELINE_API}/graph/link-sources/options`, {
          credentials: "include",
        });
        if (optRes.ok) {
          const optData = await optRes.json().catch(() => ({}));
          if (optData.linkSources) linkSourcesOptions = optData.linkSources;
        }
      } finally {
        linkSourcesOptionsLoading = false;
      }
    } catch {
      importError = "Network error while importing sources.";
    } finally {
      importingLoading = false;
    }
  }

  async function startEmbedBackfill() {
    if (!embedOptions?.enabled || !embedOptions.health.actionNeeded || embeddingBackfill) return;
    embedError = null;
    embeddingBackfill = true;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: embedOptions.recommendedScope,
          ...(embedRouteId ? { embedding_route_id: embedRouteId } : {}),
          ...(graph.domainPackId ? { domain_pack_id: graph.domainPackId } : {}),
          ...(activeRunId ? { cohort_run_id: activeRunId } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof body.message === "string"
            ? body.message
            : typeof body.error === "string"
              ? body.error.replace(/_/g, " ")
              : `Could not start embed backfill (HTTP ${res.status}).`;
        embedError = msg;
        return;
      }
      const jobId = body.job?.id;
      if (!jobId) {
        embedError = "Embed backfill started but no job id was returned.";
        return;
      }
      readinessEmbedStepComplete = true;
      await goto(`${RUNS_HREF}/${jobId}?from=graph&task=embed-backfill`);
    } catch {
      embedError = "Network error while starting embed backfill.";
    } finally {
      embeddingBackfill = false;
    }
  }

  async function startBatchValidation() {
    if (!revalidateOptions?.enabled || batchValidating) return;
    batchValidateError = null;
    batchValidating = true;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // A cohort run validates its stamped members; scope stays "unchecked"
          // and the cohort_run_id filter narrows to just that cohort.
          scope: activeRunId ? "unchecked" : validateScope,
          mode: "validate",
          validation_mode: validateMode,
          // A bounded batch must be allowed to auto-continue for ANY scope (and for
          // cohort runs) — otherwise only the first batch ever runs and the rest of
          // the backlog is silently left behind.
          ...(batchSize > 0
            ? { max_units: batchSize, continue_in_background: continueInBackground }
            : {}),
          // Trust mode uses no LLM, so a validation route is irrelevant.
          ...(validateMode === "ai" && revalidateRouteId
            ? { validation_route_id: revalidateRouteId }
            : {}),
          ...(graph.domainPackId ? { domain_pack_id: graph.domainPackId } : {}),
          ...(activeRunId ? { cohort_run_id: activeRunId } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        batchValidateError =
          typeof body.message === "string"
            ? body.message
            : typeof body.error === "string"
              ? body.error.replace(/_/g, " ")
              : `Could not start validation (HTTP ${res.status}).`;
        return;
      }
      const jobId = body.job?.id;
      if (!jobId) {
        batchValidateError = "Validation started but no job id was returned.";
        return;
      }
      await goto(`${RUNS_HREF}/${jobId}?from=graph&task=revalidate`);
    } catch {
      batchValidateError = "Network error while starting validation.";
    } finally {
      batchValidating = false;
    }
  }

  async function startAutoRemediation(scope: "quarantine" | "unsupported" = "quarantine") {
    if (!revalidateOptions?.enabled || autoRemediating) return;
    revalidateError = null;
    autoRemediating = true;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          // Remediate ideas already flagged in the store — no re-validation pass.
          mode: "remediate",
          remediation_strictness: remediateStrictness,
          ...(remediateThreshold != null ? { remediation_threshold: remediateThreshold } : {}),
          ...(remediateBatchSize > 0 ? { max_units: remediateBatchSize } : {}),
          ...(remediateContinueInBackground ? { continue_in_background: true } : {}),
          // Repaired ideas are re-validated with this route; remediation uses the other.
          ...(revalidateRouteId ? { validation_route_id: revalidateRouteId } : {}),
          ...(remediationRouteId ? { remediation_route_id: remediationRouteId } : {}),
          ...(graph.domainPackId ? { domain_pack_id: graph.domainPackId } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof body.message === "string"
            ? body.message
            : typeof body.error === "string"
              ? body.error.replace(/_/g, " ")
              : `Could not start auto-remediation (HTTP ${res.status}).`;
        revalidateError = msg;
        return;
      }
      const jobId = body.job?.id;
      if (!jobId) {
        revalidateError = "Auto-remediation started but no job id was returned.";
        return;
      }
      await goto(`${RUNS_HREF}/${jobId}?from=graph&task=auto-remediate`);
    } catch {
      revalidateError = "Network error while starting auto-remediation.";
    } finally {
      autoRemediating = false;
    }
  }
</script>

<svelte:window on:keydown={handleReviewKeydown} />

<div class="connect-graph-explorer" class:as-of-readonly={asOfActive} data-as-of-readonly={asOfActive ? "true" : null}>
  <BrutalPageHeader
    kicker="Connect · Quality review"
    title="Knowledge graph"
    description="Inspect ideas extracted from your sources, confirm AI validation, and keep agent context trustworthy. {storeLabel}{graph.domainPackTitle ? ` · pack: ${graph.domainPackTitle}` : ''}."
  />

  <!-- W2.5 — As-of time travel control. -->
  <section class="as-of-control brut-fill-canvas" aria-label="View graph as of a past time">
    <div class="as-of-row">
      <span class="as-of-kicker">VIEW AS OF</span>
      <label class="as-of-field">
        <span class="visually-hidden">As-of date and time</span>
        <input
          type="datetime-local"
          class="as-of-input brut-focus"
          bind:value={asOfDraft}
          aria-label="As-of date and time"
        />
      </label>
      <button
        type="button"
        class="brutal-btn brut-pressable brut-focus as-of-apply"
        disabled={!normalizeAsOf(asOfDraft) || initialUnitsLoading}
        on:click={applyAsOfDraft}
      >
        View at this time
      </button>
      {#if asOfActive}
        <button
          type="button"
          class="brutal-btn brut-pressable brut-focus as-of-now"
          on:click={returnToNow}
        >
          Return to now
        </button>
      {/if}
    </div>
    {#if asOfAnchors.length > 0}
      <div class="as-of-anchors" role="group" aria-label="Jump to a run timestamp">
        <span class="as-of-anchors-label brut-muted">Run anchors:</span>
        {#each asOfAnchors as anchor (anchor.id)}
          <button
            type="button"
            class="as-of-anchor brut-focus"
            class:as-of-anchor-active={asOf === anchor.iso}
            on:click={() => applyAsOfAnchor(anchor.iso)}
          >
            {anchor.label || fmtAsOfLabel(anchor.iso)}
          </button>
        {/each}
      </div>
    {/if}
  </section>

  {#if asOfActive}
    <!-- Persistent, dismissable historical-view banner (read-only state). -->
    <aside class="as-of-banner" role="status" aria-live="polite">
      {#if asOfDegraded}
        <div class="as-of-banner-body as-of-banner-degraded">
          <strong class="as-of-banner-title">⚠ History not available for this graph</strong>
          <p class="as-of-banner-text">
            {#if asOfStatus?.reason === "surreal_version_chains_unavailable"}
              Your graph store does not keep version history yet, so the state at
              {fmtAsOfLabel(asOf)} cannot be reconstructed. The current view is shown
              unchanged — it is not historical data. Version history is recorded on the
              Postgres graph spine; BYO Surreal stores need the version-chain opt-in.
            {:else if asOfStatus?.reason === "graph_target_not_configured"}
              No graph store is connected, so there is no history to travel through.
            {:else if asOfStatus?.reason === "as_of_fetch_failed"}
              The historical view at {fmtAsOfLabel(asOf)} could not be loaded — the list
              below may be incomplete or stale. This is not confirmed historical data.
              {#if loadMoreError}<span class="brut-muted"> ({loadMoreError})</span>{/if}
            {:else}
              The version history could not be read just now, so the state at
              {fmtAsOfLabel(asOf)} cannot be shown. The current view is unchanged.
            {/if}
          </p>
          <div class="as-of-banner-actions">
            <button type="button" class="brutal-btn brut-pressable brut-focus" on:click={returnToNow}>
              Return to now
            </button>
          </div>
        </div>
      {:else}
        <div class="as-of-banner-body">
          <strong class="as-of-banner-title">
            {#if asOf}
              Viewing graph as of {fmtAsOfLabel(asOf)}
            {:else}
              Viewing full version history (audit)
            {/if}
          </strong>
          <p class="as-of-banner-text">
            {#if asOf}
              Each idea below shows the <strong>claim text that was live at that instant</strong>
              and which version was current. Review verdicts, source provenance and the graph
              counts above are <strong>not</strong> reconstructed for the past — they are hidden
              here rather than shown as if historical. Editing past state is not possible —
              review and dossier actions are disabled.
            {:else}
              Every version of each claim chain is shown, including superseded ones.
              This is a read-only audit view; counts and verdicts are not historical.
            {/if}
            {#if asOfStatus?.applied && (asOfStatus.substituted || asOfStatus.excluded || asOfStatus.unversioned)}
              <span class="as-of-banner-stats brut-muted">
                {#if asOfStatus.substituted}{asOfStatus.substituted} shown at an older version. {/if}
                {#if asOfStatus.excluded}{asOfStatus.excluded} did not exist yet. {/if}
                {#if asOfStatus.unversioned}{asOfStatus.unversioned} have unknown history (kept, not filtered).{/if}
              </span>
            {/if}
          </p>
          <div class="as-of-banner-actions">
            <button
              type="button"
              class="as-of-audit-toggle brut-focus"
              aria-pressed={includeSuperseded}
              on:click={toggleIncludeSuperseded}
            >
              {includeSuperseded ? "Hide superseded versions" : "Include superseded versions"}
            </button>
            <button type="button" class="brutal-btn brut-pressable brut-focus" on:click={returnToNow}>
              Return to now
            </button>
          </div>
        </div>
      {/if}
    </aside>
  {/if}

  {#if !stats && graph.store === "surreal" && !graph.targetStatus}
    <BrutalCard fill="canvas" title="Loading graph">
      <p class="brut-muted" role="status" aria-busy="true">
        Connecting to your SurrealDB store and loading graph counts…
      </p>
    </BrutalCard>
  {:else if !stats || stats.units === 0}
    <BrutalCard fill="canvas" title="Empty graph">
      <p class="brut-muted">
        {#if graph.store === "surreal"}
          {#if graph.targetStatus === "error"}
            Could not reach your SurrealDB store. Fix credentials in Pipeline → Graph store, then refresh.
          {:else if graph.targetStatus === "untested"}
            SurrealDB is configured but not verified. Test the connection, then refresh.
          {:else}
            Your Surreal store has no matching units yet. Run ingestion with the same domain pack schema as your tables.
          {/if}
        {:else if graph.store === "none"}
          Connect a graph store in Pipeline, then run ingestion.
        {:else}
          Run ingestion to populate your graph.
        {/if}
      </p>
      <div class="empty-actions">
        {#if graph.store === "surreal" && graph.targetStatus}
          <BrutalButton variant="blue" href={pipelineWizardHref("store")}>Graph store setup</BrutalButton>
        {:else}
          <BrutalButton variant="blue" href={pipelineWizardHref("launch")}>Start a run</BrutalButton>
        {/if}
        <BrutalButton variant="canvas" href={HOME_HREF}>Home</BrutalButton>
      </div>
    </BrutalCard>
  {:else}
    {#if asOfProjected}
      <!--
        B1: the bento + validation breakdown render SSR-CURRENT graph.stats, which are NOT
        projected onto the as-of instant. Showing them beneath the "as of …" banner would
        assert current counts as historical. Under an applied historical view we absent them
        and surface only what we can honestly derive from the projected list itself.
      -->
      <BrutalCard fill="canvas" title="Counts at this instant aren't available">
        <p class="brut-muted">
          Idea, connection, group, embedding and validation counts describe the graph
          <strong>now</strong>, not {fmtAsOfLabel(asOf)}. They are hidden here rather than
          shown as if historical. What you can rely on below is the claim text and version
          that were live at the instant.
        </p>
        <p class="as-of-projection-summary brut-muted">
          <strong>{units.length.toLocaleString()}</strong>
          claim{units.length === 1 ? "" : "s"} in this projection (loaded)
          {#if asOfStatus?.applied && asOfStatus.excluded}
            · {asOfStatus.excluded.toLocaleString()} did not exist yet
          {/if}
          {#if asOfStatus?.applied && asOfStatus.substituted}
            · {asOfStatus.substituted.toLocaleString()} shown at an older version
          {/if}
          {#if asOfStatus?.applied && asOfStatus.unversioned}
            · {asOfStatus.unversioned.toLocaleString()} unknown history (kept)
          {/if}
        </p>
      </BrutalCard>
    {:else}
    <BrutalBentoGrid columns={4}>
      <BrutalBentoCell fill="white" label="Ideas">
        <p class="bento-stat">{stats.units.toLocaleString()}</p>
      </BrutalBentoCell>
      <BrutalBentoCell fill="white" label="Connections">
        <div class="bento-stat-stack">
          {#if graph.statsPartial && stats.relations === 0}
            <p class="bento-stat bento-stat--calculating" aria-label="Calculating…">—</p>
          {:else}
            <p class="bento-stat">{stats.relations.toLocaleString()}</p>
          {/if}
          {#if workspaceMode === "triage"}
            <span class="bento-stat-hint">↓ Review below</span>
          {/if}
        </div>
      </BrutalBentoCell>
      <BrutalBentoCell fill="canvas" label="Groups">
        {#if graph.statsPartial && stats.groups === 0}
          <p class="bento-stat bento-stat--calculating" aria-label="Calculating…">—</p>
        {:else}
          <button
            type="button"
            class="bento-stat-btn brut-focus"
            disabled={stats.groups === 0}
            aria-label="Open clusters view ({stats.groups} groups)"
            on:click={() => {
              workspaceMode = "clusters";
              if (graph.groups.length > 0) selectedGroupId = graph.groups[0].id;
            }}
          >
            <span class="bento-stat">{stats.groups.toLocaleString()}</span>
          </button>
        {/if}
      </BrutalBentoCell>
      <BrutalBentoCell fill="neon" label="Embedded">
        {#if graph.statsPartial && stats.embedded === 0}
          <p class="bento-stat bento-stat--calculating" aria-label="Calculating…">—</p>
        {:else if unembeddedCount > 0}
          <button
            type="button"
            class="bento-stat-btn brut-focus"
            aria-label="{stats.embedded.toLocaleString()} embedded — {unembeddedCount.toLocaleString()} missing — open embed tool"
            on:click={() => {
              workspaceMode = "tools";
              scrollToGraphReadinessWizard();
            }}
          >
            <div class="bento-stat-stack">
              <span class="bento-stat">{stats.embedded.toLocaleString()}</span>
              <span class="bento-stat-hint bento-stat-hint--warn">
                {unembeddedCount.toLocaleString()} missing — Tools ↓
              </span>
            </div>
          </button>
        {:else}
          <div class="bento-stat-stack">
            <p class="bento-stat">{stats.embedded.toLocaleString()}</p>
            <span class="bento-stat-hint">↓ Ready for retrieval</span>
          </div>
        {/if}
      </BrutalBentoCell>
      <BrutalBentoCell span={4} fill="white" label="Validation breakdown">
        <ul class="validation-breakdown" aria-label="Validation counts — click to narrow the triage list">
          <li>
            <button
              type="button"
              class="vb-stat vb-stat--verdict-ok brut-focus"
              on:click={() => applyVerdictFilter("ok")}
            >
              <span class="vb-label">Supported</span><strong>{stats.validation.ok}</strong>
            </button>
          </li>
          <li>
            <button
              type="button"
              class="vb-stat vb-stat--verdict-weak brut-focus"
              on:click={() => applyVerdictFilter("weak")}
            >
              <span class="vb-label">Weak</span><strong>{stats.validation.weak}</strong>
            </button>
          </li>
          <li>
            <button
              type="button"
              class="vb-stat vb-stat--verdict-unsupported brut-focus"
              on:click={() => applyVerdictFilter("unsupported")}
            >
              <span class="vb-label">Unsupported</span><strong>{stats.validation.unsupported}</strong>
            </button>
          </li>
        </ul>
        {#if stats.validation.unsupported > 0 || needsReviewCount > 0}
          <p class="review-hint">
            <strong>{stats.validation.unsupported.toLocaleString()}</strong>
            idea{stats.validation.unsupported === 1 ? "" : "s"} are unsupported —
            <strong>{needsReviewCount.toLocaleString()}</strong>
            {needsReviewCount === 1 ? "is" : "are"} in your quarantine queue awaiting review.
            {#if reviewedUnsupportedCount > 0}
              The remaining <strong>{reviewedUnsupportedCount.toLocaleString()}</strong>
              unsupported {reviewedUnsupportedCount === 1 ? "was" : "were"} already reviewed or auto-resolved.
            {/if}
            {#if quarantineIncludesWeak}
              (Includes weak claims awaiting review.)
            {/if}
          </p>
          <p class="review-hint review-hint-actions">
            <button
              type="button"
              class="glossary-jump brut-focus"
              on:click={() => {
                workspaceMode = "triage";
                setQueueScope("review");
              }}
            >
              Open Triage · Quarantine
            </button>
            {#if revalidateOptions?.enabled}
              ·
              <button
                type="button"
                class="glossary-jump brut-focus"
                on:click={() => {
                  workspaceMode = "tools";
                }}
              >
                Auto-remediate in Tools
              </button>
            {/if}
          </p>
        {:else if uncheckedCount > 0}
          <p class="review-hint brut-muted">
            <strong>{uncheckedCount}</strong> idea{uncheckedCount === 1 ? "" : "s"} unchecked —
            <button type="button" class="glossary-jump brut-focus" on:click={() => (workspaceMode = "tools")}>
              auto-remediate in Tools
            </button>
            or re-run ingestion.
          </p>
        {:else}
          <p class="review-hint brut-muted">All loaded ideas have a validation verdict. Spot-check supported items any time.</p>
        {/if}
      </BrutalBentoCell>
    </BrutalBentoGrid>
    {/if}

    <div class="graph-workspace" aria-label="Knowledge graph workspace">
      <figure class="graph-flow-map" aria-labelledby="graph-flow-caption">
        <figcaption id="graph-flow-caption" class="graph-flow-caption">
          How this page fits together: ingestion builds <strong>ideas</strong> and <strong>clusters</strong>; you triage quality here before agents retrieve context.
        </figcaption>
        <svg class="graph-flow-svg" viewBox="0 0 520 56" width="100%" height="auto" aria-hidden="true">
          <rect class="flow-box" x="4" y="8" width="108" height="40" rx="4" />
          <text class="flow-text" x="58" y="26" text-anchor="middle">Sources</text>
          <text class="flow-sub" x="58" y="40" text-anchor="middle">ingest</text>
          <line class="flow-line" x1="116" y1="28" x2="148" y2="28" />
          <rect class="flow-box flow-box-active" x="152" y="8" width="108" height="40" rx="4" />
          <text class="flow-text" x="206" y="26" text-anchor="middle">Ideas</text>
          <text class="flow-sub" x="206" y="40" text-anchor="middle">triage</text>
          <line class="flow-line" x1="264" y1="28" x2="296" y2="28" />
          <rect class="flow-box" x="300" y="8" width="108" height="40" rx="4" />
          <text class="flow-text" x="354" y="26" text-anchor="middle">Clusters</text>
          <text class="flow-sub" x="354" y="40" text-anchor="middle">explore</text>
          <line class="flow-line" x1="412" y1="28" x2="444" y2="28" />
          <rect class="flow-box" x="448" y="8" width="68" height="40" rx="4" />
          <text class="flow-text" x="482" y="32" text-anchor="middle">Agents</text>
        </svg>
      </figure>

      <div class="workspace-tabs" role="tablist" aria-label="Graph workspace views">
        <button
          type="button"
          role="tab"
          class="workspace-tab"
          class:workspace-tab-active={workspaceMode === "triage"}
          aria-selected={workspaceMode === "triage"}
          on:click={() => (workspaceMode = "triage")}
        >
          Triage ideas
          {#if needsReviewCount > 0}
            <span class="filter-count">{needsReviewCount}</span>
          {/if}
        </button>
        <button
          type="button"
          role="tab"
          class="workspace-tab"
          class:workspace-tab-active={workspaceMode === "clusters"}
          aria-selected={workspaceMode === "clusters"}
          disabled={graph.groups.length === 0}
          on:click={() => {
            workspaceMode = "clusters";
            if (!selectedGroupId && graph.groups[0]) selectedGroupId = graph.groups[0].id;
          }}
        >
          Clusters
          <span class="workspace-tab-meta">{stats.groups.toLocaleString()}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="workspace-tab"
          class:workspace-tab-active={workspaceMode === "tools"}
          aria-selected={workspaceMode === "tools"}
          on:click={() => (workspaceMode = "tools")}
        >
          Tools &amp; glossary
        </button>
      </div>

    {#if actionError || unitsLoadError}
      <div class="workspace-alerts">
        {#if actionError}
          <BrutalErrorBanner title="Review not saved" message={actionError} />
        {/if}
        {#if unitsLoadError}
          <BrutalErrorBanner title="Review queue could not load ideas" message={unitsLoadError} />
        {/if}
      </div>
    {/if}

    {#if workspaceMode === "triage"}
    {#if deskActive}
      <div class="desk-mount">
        <ClaimsStampingDesk
          bind:this={deskComponent}
          claim={selectedUnit
            ? { id: selectedUnit.id, text: selectedUnit.text, evidence: selectedUnit.evidence ?? null }
            : null}
          guidance={reviewGuidance}
          position={deskPosition}
          total={filteredUnits.length}
          tally={deskTally}
          lastStamp={deskLastStamp}
          readonly={deskReadonly}
          readonlyReason={asOfActive ? "Editing past state is not possible." : "This view is read-only on small screens."}
          bind:note={reviewNote}
          onStamp={deskStamp}
          onAdvance={deskAdvance}
          onRetreat={deskRetreat}
          onUndo={deskUndo}
          onExit={exitDesk}
          onOpenEvidence={deskOpenEvidence}
        />
      </div>
    {/if}
    <div class="graph-layout" role="tabpanel" aria-labelledby="workspace-tab-triage">
      <section class="review-panel" aria-labelledby="review-queue-heading">
        <div class="panel-head">
          <h2 id="review-queue-heading" class="panel-title">Review queue</h2>
          <p class="panel-lede brut-muted">
            {#if reviewEnabled}
              Select an idea, read the AI note, then approve, override, or remove items that are true but not relevant to your graph.
            {:else}
              Read-only preview — connect a graph store to enable operator review.
            {/if}
          </p>
          {#if needsReviewCount > 0}
            <p class="queue-count-live" role="status">
              <strong>{needsReviewCount.toLocaleString()}</strong>
              idea{needsReviewCount === 1 ? "" : "s"} awaiting your review
            </p>
          {/if}
          {#if reviewEnabled && needsReviewCount > 0}
            <div class="desk-enter-row">
              {#if deskReadonly}
                <p class="desk-enter-disabled brut-muted" role="note">
                  Stamping desk unavailable here —
                  {asOfActive
                    ? "editing past state is not possible."
                    : "this view is read-only on small screens."}
                </p>
              {:else}
                <button
                  type="button"
                  class="brutal-btn brut-pressable brut-focus desk-enter"
                  on:click={enterDesk}
                >
                  Open stamping desk
                  <span class="desk-enter-hint" aria-hidden="true">keyboard triage</span>
                </button>
              {/if}
            </div>
          {/if}
          {#if showCtaContext && !ctaContextDismissed && needsReviewCount > 0}
            <div class="cta-context-line" role="status">
              <span>
                Showing <strong>{needsReviewCount.toLocaleString()}</strong>
                flagged {needsReviewCount === 1 ? "idea" : "ideas"} from your trust scorecard
              </span>
              <button
                type="button"
                class="cta-context-dismiss brut-focus"
                aria-label="Dismiss scorecard context message"
                on:click={() => { ctaContextDismissed = true; }}
              >
                ✕
              </button>
            </div>
          {/if}
          {#if stats && stats.units > 0}
            <p class="units-load-meta" role="status" aria-busy={initialUnitsLoading}>
              {initialUnitsLoading ? "Loading first page of ideas…" : unitsLoadedLabel}
            </p>
            {#if hasMoreUnits}
              <button
                type="button"
                class="btn btn-secondary btn-sm load-more-units"
                disabled={loadingMoreUnits}
                on:click={loadMoreUnits}
              >
                {loadingMoreUnits ? "Loading ideas…" : "Load more ideas"}
              </button>
            {/if}
            {#if loadMoreError}
              <p class="load-more-error" role="alert">{loadMoreError}</p>
            {/if}
          {/if}
        </div>

        {#if scopedGroup}
          <div class="scope-banner" role="status">
            <p>
              Showing ideas linked to cluster <strong>{scopedGroup.name}</strong>
              ({unitsMatchingGroup(scopedGroup, units).length} in graph).
            </p>
            <button type="button" class="scope-clear brut-focus" on:click={clearGroupScope}>Clear cluster filter</button>
          </div>
        {/if}

        <p class="filter-hint brut-muted">
          <button
            type="button"
            class="glossary-jump brut-focus"
            on:click={() => {
              workspaceMode = "tools";
              glossaryOpen = true;
            }}
          >
            Explain verdicts &amp; tags
          </button>
          {#if graph.groups.length > 0}
            ·
            <button type="button" class="glossary-jump brut-focus" on:click={() => (workspaceMode = "clusters")}>
              Browse clusters
            </button>
          {/if}
        </p>

        <div class="queue-filter-bar">
          <div class="queue-filter-scope" role="tablist" aria-label="Queue scope">
            <button
              type="button"
              class="queue-filter queue-filter--scope"
              class:queue-filter-active={queueScope === "review"}
              role="tab"
              aria-selected={queueScope === "review"}
              on:click={() => setQueueScope("review")}
            >
              Quarantine
              {#if needsReviewCount > 0}
                <span class="queue-filter-count">{needsReviewCount}</span>
              {/if}
            </button>
            <button
              type="button"
              class="queue-filter queue-filter--scope"
              class:queue-filter-active={queueScope === "all"}
              role="tab"
              aria-selected={queueScope === "all"}
              on:click={() => setQueueScope("all")}
            >
              All ideas
            </button>
          </div>
          <span class="queue-filter-divider" aria-hidden="true"></span>
          <div class="queue-filter-verdicts" role="group" aria-label="Narrow list by verdict">
            {#each GRAPH_REVIEW_VERDICT_LEGEND as verdictId (verdictId)}
              {@const legend = GRAPH_REVIEW_VERDICT_VISUAL[verdictId]}
              {@const verdictDisabled = queueScope === "review" && verdictId === "ok"}
              <button
                type="button"
                class="queue-filter queue-filter--verdict queue-filter--{verdictId}"
                class:queue-filter-active={verdictFilter === verdictId}
                class:queue-filter--inactive={verdictDisabled}
                disabled={verdictDisabled}
                aria-pressed={verdictFilter === verdictId}
                aria-disabled={verdictDisabled}
                title={verdictDisabled
                  ? "Supported ideas are not in quarantine — switch to All ideas"
                  : undefined}
                aria-label={verdictDisabled
                  ? `${legend.label} — not available in quarantine`
                  : `Narrow to ${legend.label} within ${queueScope === "review" ? "quarantine" : "all ideas"}`}
                on:click={() => toggleVerdictFilter(verdictId)}
              >
                <span class="queue-filter-swatch" aria-hidden="true"></span>
                <span class="queue-filter-label">{legend.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="evidence-facet-bar" role="group" aria-label="Evidence: narrow by verification state">
          <span class="evidence-facet-label">Evidence</span>
          {#each VERIFICATION_STATES as state (state)}
            {@const visual = VERIFICATION_STATE_VISUAL[state]}
            <button
              type="button"
              class="evidence-chip {visual.chipClass}"
              class:evidence-chip-active={verificationStateFilter === state}
              aria-pressed={verificationStateFilter === state}
              title={visual.meaning}
              on:click={() => toggleEvidenceFacet(state)}
            >
              <span class="evidence-chip-label">{visual.label}</span>
              {#if evidenceStateCounts && !asOfProjected}
                <span class="evidence-chip-count">{evidenceStateCounts[state].toLocaleString()}</span>
              {/if}
            </button>
          {/each}
          {#if asOfProjected}
            <span class="evidence-facet-note brut-muted">counts at this instant aren't available — filtering the loaded projection only</span>
          {:else if !evidenceStateCounts}
            <span class="evidence-facet-note brut-muted">counts unavailable — filtering loaded ideas only</span>
          {:else if preEvidenceCount > 0}
            <span class="evidence-facet-note brut-muted">
              {preEvidenceCount.toLocaleString()} predate evidence binding — re-ingest to bind
            </span>
          {/if}
        </div>

        {#if verificationStateFilter}
          {@const activeFacet = VERIFICATION_STATE_VISUAL[verificationStateFilter]}
          <p class="queue-filter-status" role="status">
            Narrowing <strong>All ideas</strong> to
            <strong>{activeFacet.label}</strong> claims only.
            <button
              type="button"
              class="glossary-jump brut-focus"
              on:click={() => {
                verificationStateFilter = null;
                queuePage = 0;
              }}
            >
              Show all in this list
            </button>
          </p>
        {/if}

        {#if verdictFilter}
          {@const activeVerdict = GRAPH_REVIEW_VERDICT_VISUAL[verdictFilter]}
          <p class="queue-filter-status" role="status">
            Narrowing
            <strong>{queueScope === "review" ? "Quarantine" : "All ideas"}</strong>
            to
            <strong>{activeVerdict.label}</strong> only.
            <button
              type="button"
              class="glossary-jump brut-focus"
              on:click={() => {
                verdictFilter = null;
                queuePage = 0;
              }}
            >
              Show all in this list
            </button>
          </p>
        {/if}

        {#if filteredUnits.length > QUEUE_PAGE_SIZE}
          <nav class="queue-pager" aria-label="Review queue pagination">
            <button
              type="button"
              class="queue-pager-btn brut-focus"
              disabled={queuePageSafe === 0}
              on:click={() => (queuePage = Math.max(0, queuePageSafe - 1))}
            >
              Previous
            </button>
            <span class="queue-pager-status">
              Page {queuePageSafe + 1} of {queuePageCount}
              <span class="brut-muted">· {filteredUnits.length.toLocaleString()} ideas</span>
            </span>
            <button
              type="button"
              class="queue-pager-btn brut-focus"
              disabled={queuePageSafe >= queuePageCount - 1}
              on:click={() => (queuePage = Math.min(queuePageCount - 1, queuePageSafe + 1))}
            >
              Next
            </button>
          </nav>
        {/if}

        {#if selectedOffPage && selectedPageIndex != null}
          <p class="queue-off-page" role="status">
            Selected idea is on page {selectedPageIndex + 1}.
            <button
              type="button"
              class="glossary-jump brut-focus"
              on:click={() => (queuePage = selectedPageIndex)}
            >
              Go to that page
            </button>
          </p>
        {/if}

        {#if filteredUnits.length === 0}
          <BrutalCard fill="canvas">
            <p class="brut-muted">
              {#if initialUnitsLoading}
                Loading ideas from your graph store…
              {:else if unitsLoadError}
                Fix the error above, then refresh. Stats may still reflect your full graph even when the review list cannot load.
              {:else if !asOfProjected && queueScope === "review" && !verdictFilter && needsReviewCount > 0 && units.length < (stats?.units ?? 0)}
                Your graph has {needsReviewCount.toLocaleString()} flagged idea{needsReviewCount === 1 ? "" : "s"}, but
                none appear in the {units.length.toLocaleString()} ideas loaded here. Refresh the page; if this persists,
                check Surreal connectivity in Pipeline → Graph store.
              {:else if verificationStateFilter}
                {@const emptyFacet = VERIFICATION_STATE_VISUAL[verificationStateFilter]}
                No <strong>{emptyFacet.label.toLowerCase()}</strong> claims among the loaded ideas.
                {#if evidenceStateCounts && !asOfProjected && evidenceStateCounts[verificationStateFilter] > 0}
                  Your graph has {evidenceStateCounts[verificationStateFilter].toLocaleString()} —
                  load more ideas below to bring them in.
                {/if}
                <button
                  type="button"
                  class="glossary-jump brut-focus"
                  on:click={() => {
                    verificationStateFilter = null;
                    queuePage = 0;
                  }}
                >
                  Clear evidence filter
                </button>
              {:else if verdictFilter}
                {@const emptyVerdict = GRAPH_REVIEW_VERDICT_VISUAL[verdictFilter]}
                No <strong>{emptyVerdict.label.toLowerCase()}</strong> ideas in
                <strong>{queueScope === "review" ? "quarantine" : "all loaded ideas"}</strong>.
                <button
                  type="button"
                  class="glossary-jump brut-focus"
                  on:click={() => {
                    verdictFilter = null;
                    queuePage = 0;
                  }}
                >
                  Clear verdict narrow
                </button>
                or switch list scope.
              {:else}
                No ideas in this list.
              {/if}
            </p>
          </BrutalCard>
        {:else}
          <ul class="unit-list" aria-label="Ideas to review">
            {#each paginatedUnits as unit (unit.id)}
              {@const verdict = graphReviewVerdictVisual(unit.validationStatus)}
              <li>
                <button
                  type="button"
                  class="unit-row {verdict.rowClass}"
                  class:unit-row-selected={selectedUnit?.id === unit.id}
                  class:unit-row-exiting={exitingUnitId === unit.id}
                  on:click={() => selectUnit(unit)}
                  aria-pressed={selectedUnit?.id === unit.id}
                  aria-label="{verdict.label}: {unit.text}"
                >
                  <span class="unit-row-inner">
                    <span class="unit-row-top">
                      {#if unit.asOfHistorical}
                        <span class="unit-status-badge unit-status-badge--historical" title="This is a prior version of the claim. Its review verdict and source at that instant are not recorded, so no historical verdict is shown.">
                          Prior version · verdict not historical
                        </span>
                      {:else}
                        <span class="unit-status-badge">{statusLabel(unit.validationStatus)}</span>
                      {/if}
                      {#if unit.unitType}<span class="unit-meta">{unit.unitType}</span>{/if}
                      {#if unit.domain}<span class="unit-meta unit-domain">{unit.domain}</span>{/if}
                    </span>
                    <p class="unit-row-text">{unit.text}</p>
                    {#if hasProvenance(unit)}
                      <p class="unit-provenance">
                        {#if unit.author}<span class="prov-author">{unit.author}</span>{/if}
                        {#if unit.sourceTitle}
                          {#if unit.author}<span class="prov-sep" aria-hidden="true">·</span>{/if}
                          <span class="prov-source">{unit.sourceTitle}</span>
                        {/if}
                      </p>
                    {/if}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
          {#if filteredUnits.length > QUEUE_PAGE_SIZE}
            <nav class="queue-pager queue-pager-foot" aria-label="Review queue pagination">
              <button
                type="button"
                class="queue-pager-btn brut-focus"
                disabled={queuePageSafe === 0}
                on:click={() => (queuePage = Math.max(0, queuePageSafe - 1))}
              >
                Previous
              </button>
              <span class="queue-pager-status">
                Page {queuePageSafe + 1} of {queuePageCount}
              </span>
              <button
                type="button"
                class="queue-pager-btn brut-focus"
                disabled={queuePageSafe >= queuePageCount - 1}
                on:click={() => (queuePage = Math.min(queuePageCount - 1, queuePageSafe + 1))}
              >
                Next
              </button>
            </nav>
          {/if}
        {/if}
      </section>

      <aside class="detail-panel" aria-labelledby="detail-heading">
        {#if selectedUnit}
          <BrutalCard fill="white" title="Selected idea">
            <h2 id="detail-heading" class="visually-hidden">Selected idea detail</h2>
            <div class="detail-badges">
              {#if selectedUnit.asOfHistorical}
                <BrutalBadge variant="canvas" label="Prior version · verdict not historical" />
              {:else}
                <BrutalBadge variant={badgeVariant(selectedUnit.validationStatus)} label={statusLabel(selectedUnit.validationStatus)} />
              {/if}
            </div>
            {#if selectedUnit.asOfHistorical}
              <p class="detail-historical-note brut-muted">
                This is the claim text recorded at the selected instant. Its review verdict
                and source provenance at that time are not stored, so they are not shown here.
              </p>
            {/if}
            <p class="detail-text">{selectedUnit.text}</p>

            <section class="dossier" aria-label="Evidence dossier">
              <div class="dossier-stamp-row">
                <div
                  class="dossier-stamp {selectedStampVisual.stampClass}"
                  role="img"
                  aria-label="Verification state: {selectedStampVisual.label}. {selectedStampVisual.meaning}"
                  title={selectedStampVisual.meaning}
                >
                  <span class="dossier-stamp-text">{selectedStampVisual.stamp}</span>
                  {#if stampRingDate(selectedUnit.evidence)}
                    <span class="dossier-stamp-date">{stampRingDate(selectedUnit.evidence)}</span>
                  {/if}
                </div>
              </div>

              {#if predatesEvidenceBinding(selectedUnit.evidence ?? null)}
                <p class="dossier-empty" role="note">
                  This claim predates evidence binding — re-ingest its source to bind a
                  verbatim span. Without a bound span it can never be marked supported.
                </p>
              {:else if dossierLoading && !selectedDossier}
                <p class="dossier-loading" role="status">Loading evidence…</p>
              {:else if dossierError}
                <p class="dossier-error" role="alert">{dossierError}</p>
                <button
                  type="button"
                  class="glossary-jump brut-focus"
                  on:click={() => selectedUnit && loadDossier(selectedUnit, true)}
                >
                  Try again
                </button>
              {:else if selectedDossier}
                {@const dossier = selectedDossier}
                {@const evidence = selectedUnit.evidence ?? dossier.summary}

                {#if evidence?.evidence}
                  <figure class="evidence-card">
                    <figcaption class="evidence-card-cap">
                      <span class="evidence-card-source">{dossier.source.title ?? "Source"}</span>
                      {#if dossier.source.url}
                        <a
                          class="evidence-card-open brut-focus"
                          href={dossier.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          open source ↗
                        </a>
                      {/if}
                    </figcaption>
                    {#if dossier.excerpt && dossier.excerpt.located !== "none"}
                      <blockquote class="evidence-card-body">
                        {#if dossier.excerpt.before}<span class="evidence-ctx">…{dossier.excerpt.before}</span>{/if}<mark
                          class="evidence-mark">{dossier.excerpt.quote}</mark>{#if dossier.excerpt.after}<span class="evidence-ctx">{dossier.excerpt.after}…</span>{/if}
                      </blockquote>
                      {#if dossier.excerpt.located === "search"}
                        <p class="evidence-note" role="note">
                          Located by verbatim search — the recorded offsets no longer hold. Run
                          “Re-check now” for the deterministic verdict.
                        </p>
                      {/if}
                    {:else}
                      <blockquote class="evidence-card-body">
                        <mark class="evidence-mark">{evidence.evidence.quote}</mark>
                      </blockquote>
                      <p class="evidence-note" role="note">
                        {#if dossier.excerpt && dossier.excerpt.located === "none" && dossier.excerpt.reason === "quote_not_in_current_text"}
                          The bound quote no longer appears in the current source text — run
                          “Re-check now” for the deterministic verdict.
                        {:else}
                          Full source text could not be resolved — the quote is shown verbatim
                          without surrounding context. Import the source text in Pipeline → Sources.
                        {/if}
                      </p>
                    {/if}
                    {#if evidence.evidence.match !== "exact"}
                      <p class="evidence-note" role="note">
                        {evidence.evidence.match} match — anything looser than exact is labeled,
                        never hidden.
                      </p>
                    {/if}
                    {#if dossier.sourceTextQuality === "preview"}
                      <p class="evidence-note" role="note">
                        Context built from a stored preview, not the full document.
                      </p>
                    {/if}
                  </figure>
                {:else}
                  <p class="dossier-empty" role="note">
                    No evidence span could be bound — this claim can never be marked supported.
                  </p>
                {/if}

                <div class="custody" role="group" aria-label="Chain of custody">
                  <span
                    class="custody-hop"
                    title={`${dossier.source.title ?? "Untitled source"}${dossier.source.kind ? ` · ${dossier.source.kind}` : ""}${evidence?.evidence?.sourceHash ? ` · hash ${evidence.evidence.sourceHash.slice(0, 12)}…` : ""}`}
                  >SOURCE</span>
                  <span class="custody-arrow" aria-hidden="true">→</span>
                  <span
                    class="custody-hop"
                    title={evidence?.evidence
                      ? `chars ${evidence.evidence.start}–${evidence.evidence.end} · ${evidence.evidence.match} match`
                      : evidence?.evidenceStatus === "no_evidence"
                        ? "extractor returned no quote"
                        : "quote did not bind to the cited source"}
                  >SPAN</span>
                  <span class="custody-arrow" aria-hidden="true">→</span>
                  <span
                    class="custody-hop"
                    title={evidence?.versions
                      ? `version ${evidence.versions.currentVersionNo ?? 1} of ${evidence.versions.count}`
                      : "version chain unavailable for this store"}
                  >CLAIM</span>
                  <span class="custody-arrow" aria-hidden="true">→</span>
                  <span
                    class="custody-hop"
                    title={evidence?.judge?.model
                      ? `${evidence.judge.model} · prompt v${evidence.judge.promptVersion ?? "?"} · ${evidence.judge.verdict ?? "?"}${evidence.judge.confidence != null ? ` · confidence ${evidence.judge.confidence}` : ""}`
                      : evidence?.judgedBy
                        ? `rule: ${evidence.judgedBy}`
                        : "not yet judged"}
                  >JUDGE{evidence?.judge?.model ? ` (${evidence.judge.model})` : ""}</span>
                  <span class="custody-arrow" aria-hidden="true">→</span>
                  <span
                    class="custody-hop"
                    title={`${evidence?.verificationState ?? "unverified"}${evidence?.judgedAt ? ` · ${fmtDossierDate(evidence.judgedAt)}` : ""}`}
                  >STATE</span>
                </div>

                <div class="dossier-recheck">
                  <button
                    type="button"
                    class="brutal-btn brut-pressable brut-focus dossier-recheck-btn"
                    disabled={recheckBusy || !evidence?.evidence}
                    title={evidence?.evidence
                      ? "Re-verify the span deterministically: source hash + offsets + quote. No model keys needed."
                      : "No bound span to re-check."}
                    on:click={() => selectedUnit && runEvidenceRecheck(selectedUnit)}
                  >
                    {recheckBusy ? "Re-checking…" : "Re-check now"}
                  </button>
                  <span class="dossier-recheck-hint brut-muted">
                    Deterministic Layer-1 check — no model calls.
                  </span>
                </div>
                {#if selectedRecheck}
                  {@const recheckCopy = recheckResultCopy(selectedRecheck)}
                  <div
                    class="recheck-result"
                    class:recheck-pass={selectedRecheck.ok}
                    class:recheck-fail={!selectedRecheck.ok}
                    role="status"
                  >
                    <p class="recheck-headline">{recheckCopy.headline}</p>
                    <p class="recheck-detail">{recheckCopy.detail}</p>
                  </div>
                {/if}

                {#if dossier.versions && dossier.versions.length > 0}
                  <details class="dossier-versions">
                    <summary class="dossier-versions-summary brut-focus">
                      Claim versions ({dossier.versions.length})
                    </summary>
                    <ul class="version-list">
                      {#each dossier.versions as v, i (`${v.versionNo}-${v.validFrom ?? i}`)}
                        <li class="version-row" class:version-current={v.current}>
                          <span class="version-no">v{v.versionNo}</span>
                          <span class="version-state">{v.verificationState ?? "unverified"}</span>
                          {#if v.superseded}
                            <span class="version-meta">
                              superseded{fmtDossierDate(v.validTo) ? ` ${fmtDossierDate(v.validTo)}` : ""} — text changed in source
                            </span>
                          {:else}
                            <span class="version-meta">
                              current{fmtDossierDate(v.validFrom) ? ` · valid from ${fmtDossierDate(v.validFrom)}` : ""}
                            </span>
                          {/if}
                        </li>
                      {/each}
                    </ul>
                  </details>
                {/if}

                {#if dossier.judgments.length > 0}
                  <details class="dossier-versions">
                    <summary class="dossier-versions-summary brut-focus">
                      Judgment history ({dossier.judgments.length}) — append-only
                    </summary>
                    <ul class="version-list">
                      {#each dossier.judgments as j, i (`${j.judgedAt ?? i}-${i}`)}
                        <li class="version-row">
                          <span class="version-state">{j.verdict}</span>
                          <span class="version-meta">
                            {j.judgeModel ?? "unknown judge"}{j.promptVersion != null ? ` · prompt v${j.promptVersion}` : ""}{j.confidence != null ? ` · confidence ${j.confidence}` : ""}{fmtDossierDate(j.judgedAt) ? ` · ${fmtDossierDate(j.judgedAt)}` : ""}
                          </span>
                        </li>
                      {/each}
                    </ul>
                  </details>
                {/if}

                {#if reviewEnabled}
                  <div class="dossier-actions" role="group" aria-label="Evidence actions">
                    <button
                      type="button"
                      class="brutal-btn brut-pressable brut-focus dossier-accept-btn"
                      disabled={evidenceActionBusy ||
                        !selectedAcceptGuard.ok ||
                        selectedUnit.evidence?.verificationState === "supported"}
                      title={selectedUnit.evidence?.verificationState === "supported"
                        ? "Already supported."
                        : selectedAcceptGuard.ok
                          ? "Mark this claim supported — allowed because its span is Layer-1 bound."
                          : selectedAcceptGuard.ok === false
                            ? selectedAcceptGuard.reason
                            : undefined}
                      on:click={() => selectedUnit && performEvidenceAccept(selectedUnit)}
                    >
                      Accept · supported
                    </button>
                    <button
                      type="button"
                      class="brutal-btn brut-pressable brut-focus dossier-exclude-btn"
                      disabled={evidenceActionBusy ||
                        selectedUnit.evidence?.verificationState === "excluded"}
                      title={selectedUnit.evidence?.verificationState === "excluded"
                        ? "Already excluded."
                        : "Soft-exclude from retrieval — reversible, never deleted."}
                      on:click={() => selectedUnit && performEvidenceExclude(selectedUnit)}
                    >
                      Exclude from retrieval
                    </button>
                  </div>
                  {#if !selectedAcceptGuard.ok && selectedUnit.evidence?.verificationState !== "supported"}
                    <p class="dossier-guard-note brut-muted" role="note">
                      {selectedAcceptGuard.ok === false ? selectedAcceptGuard.reason : ""}
                    </p>
                  {/if}
                  {#if evidenceActionError}
                    <p class="dossier-action-error" role="alert">{evidenceActionError}</p>
                  {/if}
                  <p class="dossier-rejudge-note brut-muted" role="note">
                    Re-judging (Layer 2) re-runs the model judge over this span — use
                    Tools → Re-validate. Model calls may cost.
                  </p>
                {/if}
              {/if}
            </section>

            {#if hasProvenance(selectedUnit)}
              <dl class="provenance-block brut-fill-canvas">
                <dt class="provenance-label">Provenance</dt>
                <dd class="provenance-body">
                  {#if selectedUnit.author}
                    <p class="prov-row">
                      <span class="prov-key">Author</span>
                      <span class="prov-value">{selectedUnit.author}</span>
                    </p>
                  {/if}
                  {#if selectedUnit.sourceTitle || selectedUnit.sourceUrl}
                    <p class="prov-row">
                      <span class="prov-key">Source</span>
                      <span class="prov-value">
                        {#if selectedUnit.sourceUrl}
                          <a
                            class="prov-link brut-focus"
                            href={selectedUnit.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {selectedUnit.sourceTitle ?? selectedUnit.sourceUrl}
                          </a>
                        {:else}
                          {selectedUnit.sourceTitle}
                        {/if}
                      </span>
                    </p>
                  {/if}
                  {#if selectedUnit.sourceKind}
                    <p class="prov-row">
                      <span class="prov-key">Kind</span>
                      <span class="prov-value">{sourceKindLabel(selectedUnit.sourceKind)}</span>
                    </p>
                  {/if}
                </dd>
              </dl>
            {/if}

            {#if reviewEnabled && reviewGuidance}
              <div
                class="review-guidance"
                class:review-guidance-weak={reviewGuidance.verdictTone === "weak"}
                class:review-guidance-unsupported={reviewGuidance.verdictTone === "unsupported"}
                class:review-guidance-ok={reviewGuidance.verdictTone === "ok"}
                class:review-guidance-unknown={reviewGuidance.verdictTone === "unchecked"}
                role="status"
              >
                <p class="review-guidance-kicker">Suggested review</p>
                <p class="review-guidance-headline">{reviewGuidance.headline}</p>
                <p class="review-guidance-detail">{reviewGuidance.detail}</p>
                <p class="review-guidance-hint">{reviewGuidance.actionHint}</p>

                <details
                  class="review-coaching-expander"
                  bind:open={reviewCoachingOpen}
                  on:toggle={onReviewCoachingToggle}
                >
                  <summary class="review-coaching-summary brut-focus">
                    <span class="review-coaching-summary-label">How to review this idea</span>
                    {#if reviewCoaching?.generatedBy === "note"}
                      <span class="review-coaching-badge">From AI note</span>
                    {:else if reviewCoaching?.generatedBy === "llm"}
                      <span class="review-coaching-badge">AI hint</span>
                    {/if}
                  </summary>
                  <div class="review-coaching-body">
                    <div class="review-coaching-block">
                      <h3 class="review-coaching-label">Every review</h3>
                      <ol class="review-coaching-steps">
                        {#each GRAPH_REVIEW_COMMON_STEPS as step, i (i)}
                          <li>{step}</li>
                        {/each}
                      </ol>
                    </div>
                    {#if reviewCoachingLoading}
                      <p class="review-coaching-loading" role="status">Loading hint for this idea…</p>
                    {:else if reviewCoachingError}
                      <p class="review-coaching-error" role="alert">{reviewCoachingError}</p>
                      <button
                        type="button"
                        class="glossary-jump brut-focus"
                        on:click={() => selectedUnit && loadReviewCoaching(selectedUnit, true)}
                      >
                        Try again
                      </button>
                    {:else if reviewCoaching}
                      <div class="review-coaching-block">
                        <h3 class="review-coaching-label">For this idea</h3>
                        <p class="review-coaching-lede">{reviewCoaching.focus}</p>
                        {#if reviewCoaching.lookFor.length > 0}
                          <ul class="review-coaching-checks">
                            {#each reviewCoaching.lookFor as check, i (i)}
                              <li>{check}</li>
                            {/each}
                          </ul>
                        {/if}
                      </div>
                      {#if reviewCoaching.sourceQuality === "preview"}
                        <p class="review-coaching-note brut-muted" role="note">
                          Source preview only — open the full document before overriding.
                        </p>
                      {:else if reviewCoaching.sourceQuality === "missing"}
                        <p class="review-coaching-note brut-muted" role="note">
                          No source text linked — check Pipeline → Sources.
                        </p>
                      {/if}
                    {:else}
                      <p class="review-coaching-loading brut-muted" role="status">
                        Expand to load a short hint for this idea.
                      </p>
                    {/if}
                  </div>
                </details>
              </div>
            {/if}

            {#if reviewEnabled}
              <label class="note-field" for="review-note">
                <span class="note-label">Your note (optional)</span>
                <textarea
                  id="review-note"
                  class="note-input brut-focus"
                  rows="2"
                  maxlength="500"
                  placeholder="Why you agree or disagree with the AI verdict…"
                  bind:value={reviewNote}
                ></textarea>
              </label>

              <div class="review-actions" role="group" aria-label="Set validation verdict">
                {#each REVIEW_ACTIONS as btn (btn.action)}
                  <button
                    type="button"
                    class="brutal-btn brut-pressable brut-focus review-action-btn {reviewActionFillClass(btn.action, reviewGuidance?.suggestedAction ?? null)}"
                    class:review-btn-suggested={isSuggestedReviewAction(
                      btn.action,
                      reviewGuidance?.suggestedAction ?? null,
                    )}
                    class:review-btn-flash={flashingReviewAction === btn.action}
                    aria-pressed={isSuggestedReviewAction(
                      btn.action,
                      reviewGuidance?.suggestedAction ?? null,
                    )}
                    on:click={() => performReview(selectedUnit, btn.action)}
                  >
                    <span class="review-btn-label">{btn.label}</span>
                    <span class="review-btn-key" aria-hidden="true">{btn.key}</span>
                  </button>
                {/each}
              </div>

              <div class="remove-section">
                <p class="remove-lede brut-muted">
                  True but off-topic? Remove it from the graph so agents never retrieve it — for example
                  historical trivia that does not serve your domain.
                </p>
                <button
                  type="button"
                  class="brutal-btn brut-pressable brut-focus remove-btn"
                  on:click={() => removeFromGraph(selectedUnit)}
                >
                  Remove from graph
                </button>
              </div>
            {/if}
          </BrutalCard>
        {:else}
          <BrutalCard fill="canvas" title="Select an idea">
            <p class="brut-muted">Pick an item from the queue to inspect AI validation and record your verdict.</p>
          </BrutalCard>
        {/if}

      </aside>
    </div>
    {:else if workspaceMode === "clusters"}
      <div class="clusters-layout" role="tabpanel" aria-labelledby="workspace-tab-clusters">
        <section class="clusters-index" aria-labelledby="clusters-index-heading">
          <div class="panel-head">
            <h2 id="clusters-index-heading" class="panel-title">Cluster index</h2>
            <p class="panel-lede brut-muted">
              Themes extracted during ingestion. Select a cluster to inspect members, then jump to triage for validation.
            </p>
          </div>
          <label class="cluster-search-field" for="cluster-search">
            <span class="cluster-search-label">Find cluster</span>
            <input
              id="cluster-search"
              type="search"
              class="cluster-search-input brut-focus"
              placeholder="Name, summary, or member text…"
              bind:value={groupSearch}
              autocomplete="off"
            />
          </label>
          {#if filteredGroups.length === 0}
            <BrutalCard fill="canvas">
              <p class="brut-muted">No clusters match “{groupSearch}”. Clear the search or run ingestion to add groups.</p>
            </BrutalCard>
          {:else}
            <ul class="cluster-index-list" aria-label="Graph clusters">
              {#each filteredGroups as g (g.id)}
                {@const matched = unitsMatchingGroup(g, units)}
                <li>
                  <button
                    type="button"
                    class="cluster-card"
                    class:cluster-card-selected={selectedGroupId === g.id}
                    aria-pressed={selectedGroupId === g.id}
                    on:click={() => selectGroup(g)}
                  >
                    <div class="cluster-card-top">
                      <strong class="cluster-card-name">{g.name}</strong>
                      <span class="cluster-card-count">{g.members.length} members</span>
                    </div>
                    {#if g.summary}
                      <p class="cluster-card-summary">{g.summary}</p>
                    {/if}
                    <p class="cluster-card-linked brut-muted">
                      {matched.length} linked idea{matched.length === 1 ? "" : "s"} in review queue
                    </p>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </section>

        <aside class="clusters-detail" aria-labelledby="clusters-detail-heading">
          {#if selectedGroup}
            <BrutalCard fill="white" title={selectedGroup.name}>
              <h2 id="clusters-detail-heading" class="visually-hidden">Cluster detail</h2>
              {#if selectedGroup.summary}
                <p class="cluster-detail-summary">{selectedGroup.summary}</p>
              {/if}
              <p class="cluster-detail-meta brut-muted">
                {selectedGroup.members.length} member{selectedGroup.members.length === 1 ? "" : "s"} ·
                {selectedGroupUnits.length} matched idea{selectedGroupUnits.length === 1 ? "" : "s"} in loaded queue
              </p>
              <div class="cluster-detail-actions">
                <button
                  type="button"
                  class="brutal-btn brut-pressable brut-focus brut-fill-neon"
                  disabled={selectedGroupUnits.length === 0}
                  on:click={() => applyGroupToQueue(selectedGroup)}
                >
                  Review ideas in this cluster
                </button>
              </div>

              <section class="cluster-relations" aria-labelledby="cluster-relations-heading">
                <h3 id="cluster-relations-heading" class="cluster-relations-title">Discourse relations</h3>
                <p class="cluster-relations-lede brut-muted">
                  Edges between ideas in this cluster (from your graph store). Up to 12 shown.
                </p>
                {#if clusterRelationsLoading}
                  <p class="brut-muted" role="status">Loading relations…</p>
                {:else if clusterRelationsError}
                  <p class="brut-muted" role="status">{clusterRelationsError}</p>
                {:else if selectedGroupUnits.length === 0}
                  <p class="brut-muted">Link members to loaded ideas to preview relations.</p>
                {:else if clusterRelations.length === 0}
                  <p class="brut-muted">No discourse relations found between these ideas yet.</p>
                {:else}
                  <ul class="relations-preview-list">
                    {#each clusterRelations as rel, i (`${rel.relationType}-${i}`)}
                      {@const fromUnit = rel.fromUnitId
                        ? units.find((u) => u.id === rel.fromUnitId)
                        : units.find((u) => normalizeClaimText(u.text) === normalizeClaimText(rel.fromText))}
                      {@const toUnit = rel.toUnitId
                        ? units.find((u) => u.id === rel.toUnitId)
                        : units.find((u) => normalizeClaimText(u.text) === normalizeClaimText(rel.toText))}
                      <li>
                        <div class="relation-edge">
                          <span class="relation-type">{formatRelationType(rel.relationType)}</span>
                          <div class="relation-claims">
                            {#if fromUnit}
                              <button
                                type="button"
                                class="relation-claim brut-focus"
                                on:click={() => openUnitInTriage(fromUnit)}
                              >
                                {truncatePreview(rel.fromText)}
                              </button>
                            {:else}
                              <span class="relation-claim-static">{truncatePreview(rel.fromText)}</span>
                            {/if}
                            <span class="relation-arrow" aria-hidden="true">→</span>
                            {#if toUnit}
                              <button
                                type="button"
                                class="relation-claim brut-focus"
                                on:click={() => openUnitInTriage(toUnit)}
                              >
                                {truncatePreview(rel.toText)}
                              </button>
                            {:else}
                              <span class="relation-claim-static">{truncatePreview(rel.toText)}</span>
                            {/if}
                          </div>
                        </div>
                      </li>
                    {/each}
                  </ul>
                  {#if clusterRelationsTruncated}
                    <p class="relations-more brut-muted">More relations exist in the graph — open triage to explore further.</p>
                  {/if}
                {/if}
              </section>

              {#if selectedGroup.members.length > 0}
                <ul class="member-list member-list-interactive" aria-label="Cluster members">
                  {#each selectedGroup.members as m, i (m.text + String(i))}
                    {@const linked = units.find((u) => normalizeClaimText(u.text) === normalizeClaimText(m.text))}
                    <li>
                      <button
                        type="button"
                        class="member-row brut-focus"
                        disabled={!linked}
                        title={linked ? "Open in triage" : "No matching idea in loaded queue"}
                        on:click={() => {
                          if (!linked) return;
                          groupScopeId = selectedGroup.id;
                          queuePage = 0;
                          openUnitInTriage(linked);
                        }}
                      >
                        <span class="member-row-text">
                          {#if m.role}<span class="member-role">{m.role}</span>{/if}
                          {m.text}
                        </span>
                        {#if m.validationStatus}
                          <BrutalBadge variant={badgeVariant(m.validationStatus)} label={statusLabel(m.validationStatus)} />
                        {:else if linked}
                          <BrutalBadge variant={badgeVariant(linked.validationStatus)} label={statusLabel(linked.validationStatus)} />
                        {/if}
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </BrutalCard>
          {:else}
            <BrutalCard fill="canvas" title="Select a cluster">
              <p class="brut-muted">Pick a cluster from the index to see members and jump into triage.</p>
            </BrutalCard>
          {/if}
        </aside>
      </div>
    {:else}
      <div class="tools-panel" role="tabpanel" aria-labelledby="workspace-tab-tools">
        <details
          id="graph-review-glossary"
          class="graph-glossary"
          bind:open={glossaryOpen}
        >
          <summary class="graph-glossary-summary brut-focus">
            What do these terms mean?
          </summary>
          <div class="graph-glossary-body">
            <p class="graph-glossary-lede brut-muted">
              Labels on this page describe AI validation and graph structure. Expand a section only when you need it.
            </p>
            {#each glossarySections as section (section.id)}
              <section class="glossary-section" aria-labelledby="glossary-{section.id}">
                <h3 id="glossary-{section.id}" class="glossary-section-title">{section.title}</h3>
                <dl class="glossary-dl">
                  {#each section.entries as entry (entry.term)}
                    <div class="glossary-row">
                      <dt>{entry.term}</dt>
                      <dd>{entry.description}</dd>
                    </div>
                  {/each}
                </dl>
              </section>
            {/each}
          </div>
        </details>

        {#if graph.reviewEnabled && graph.stats?.units}
          {#if graphReadinessToolsLoading}
            <p class="revalidate-lede brut-muted" role="status">
              Loading tool options… the readiness wizard is available below while counts refresh.
            </p>
          {/if}
          <ConnectReadinessLibrary
            runs={readinessRuns}
            {activeRunId}
            loading={runsLoading}
            creating={creatingRun}
            error={runsError}
            on:select={(e) => { activeRunId = e.detail.runId; }}
            on:create={(e) => createReadinessRun(e.detail.size)}
            on:archive={(e) => archiveReadinessRun(e.detail.runId)}
          />
          {#if activeRun && activeRun.status !== "complete"}
            <p class="readiness-active-run brut-muted" role="status">
              Wizard scoped to <strong>{activeRun.label}</strong> ({(activeRun.sizeActual ?? activeRun.sizeTarget).toLocaleString()}
              ideas). Link, embed, and validate below apply only to this cohort.
              <button type="button" class="readiness-active-clear brut-focus" on:click={() => { activeRunId = null; }}>
                Switch to whole workspace
              </button>
            </p>
          {/if}
          {#if activeRun && activeRun.status === "complete"}
            {@const q = activeRun.qualitySummary}
            <div class="revalidate-panel cohort-complete-panel">
              <p class="cohort-complete-kicker">Readiness run complete</p>
              <h3 class="cohort-complete-title">{activeRun.label} ✓</h3>
              {#if (activeRun.sizeActual ?? 0) === 0}
                <p class="cohort-complete-lede">
                  This run has no ideas — it was created before a cohort could be formed. Archive it
                  and start a new run.
                </p>
              {:else}
                <p class="cohort-complete-lede">
                  {(activeRun.sizeActual ?? activeRun.sizeTarget).toLocaleString()} ideas taken through the journey.
                  {#if q}
                    <strong>{q.ok.toLocaleString()}</strong> supported,
                    <strong>{q.weak.toLocaleString()}</strong> weak,
                    <strong>{q.unsupported.toLocaleString()}</strong> unsupported{#if q.okPct != null} ({q.okPct}% supported){/if}.
                  {:else}
                    Open <strong>Triage ideas</strong> to review the results.
                  {/if}
                </p>
              {/if}
              <div class="cohort-complete-actions">
                <button
                  type="button"
                  class="brutal-btn brutal-btn-primary brut-pressable brut-focus"
                  disabled={creatingRun}
                  on:click={() => createReadinessRun(activeRun?.sizeTarget ?? 100)}
                >
                  {creatingRun ? "Creating…" : `Start next run · next ${(activeRun.sizeTarget ?? 100).toLocaleString()} ideas`}
                </button>
                <button
                  type="button"
                  class="brutal-btn brutal-btn-outline brut-pressable brut-focus"
                  on:click={() => { activeRunId = null; }}
                >
                  Switch to whole workspace
                </button>
              </div>
            </div>
          {:else}
          <div class="revalidate-panel" id="graph-readiness-wizard" bind:this={graphReadinessWizardEl}>
            <ConnectGraphReadinessWizard
              graphStore={graph.store ?? "none"}
              sourcesInPipeline={sourcesInPipeline}
              initialPipelineCatalogCount={graph.sourceCatalogStatus?.pipelineCatalogCount ?? 0}
              bind:packMappingForm
              bind:linkSourcesScope
              bind:embedRouteId
              bind:batchSize
              bind:continueInBackground
              bind:validateScope
              bind:validateMode
              cohortContext={activeRun
                ? { label: activeRun.label, size: activeRun.sizeActual ?? activeRun.sizeTarget }
                : null}
              bind:revalidateRouteId
              {packMappingTitle}
              {packMappingEditable}
              {packMappingLoading}
              {packMappingLoadError}
              {savingMapping}
              {saveMappingError}
              {discoveringLoading}
              {discoveringError}
              {discoverResult}
              {syncingPack}
              {syncPackError}
              {importingLoading}
              {importError}
              {importResult}
              {linkSourcesOptions}
              {linkingSources}
              {linkSourcesError}
              {provenanceAudit}
              {provenanceAuditLoading}
              {provenanceAuditError}
              linkStepComplete={catalogLinkStepComplete}
              embedEnabled={Boolean(embedOptions?.enabled ?? graph.stats?.units)}
              unembeddedCount={embedOptions?.unembeddedCount ?? 0}
              embedWorkCount={embedOptions?.workCount ?? 0}
              embedHealth={embedOptions?.health ?? null}
              embedRecommendedScope={embedOptions?.recommendedScope ?? "missing_only"}
              embedReady={embedOptions?.embedReady ?? true}
              embedRoutes={embedOptions?.routes ?? []}
              embedModelsManageHref={embedModelsManageHref}
              embedRouteEditHref={embedRouteEditHref}
              selectedEmbedRouteLabel={selectedEmbedRoute?.activeModel
                ? `${selectedEmbedRoute.activeModel.provider}/${selectedEmbedRoute.activeModel.modelId}`
                : null}
              {embeddingBackfill}
              {embedError}
              embedStepComplete={readinessEmbedStepComplete}
              revalidateEnabled={revalidateOptions?.enabled ?? true}
              {uncheckedCount}
              revalidateRoutes={revalidateOptions?.routes ?? []}
              {batchValidating}
              {batchValidateError}
              on:scan={(e) => discoverSources(e.detail)}
              on:saveMapping={savePackMappingAndRescan}
              on:applySuggestion={applySuggestionToForm}
              on:syncPack={syncPackFromScan}
              on:import={importSources}
              on:linkSources={startSourceLinking}
              on:embed={startEmbedBackfill}
              on:validate={startBatchValidation}
            />
          </div>
          {/if}
        {/if}

        {#if revalidateOptionsLoading && workspaceMode === "tools"}
          <p class="revalidate-lede brut-muted" role="status">Loading auto-remediation options…</p>
        {:else if revalidateOptions?.enabled && !remediationUnlocked}
          <div class="revalidate-panel">
            <BrutalCard fill="canvas" title="Auto-remediate quarantine (locked)">
              <p class="revalidate-lede brut-muted">
                Remediation unlocks as soon as at least one idea has been validated. Run a
                validation pass first — then come back to repair or remove the ideas it flags.
              </p>
              <p class="revalidate-note brut-muted">
                Validate ideas in the readiness wizard above (a single cohort is enough to unlock this).
              </p>
            </BrutalCard>
          </div>
        {:else if revalidateOptions?.enabled}
          {#if quarantineCount > 0 || unsupportedUntriagedCount > 0}
            <div class="revalidate-panel">
              <BrutalCard fill="neon" title="Auto-remediate quarantine">
                <p class="revalidate-lede brut-muted">
                  Remediate ideas already flagged weak/unsupported — repair faithful wording, soft-exclude
                  ideas with no basis in the source, and re-embed repairs. No re-validation pass, so it only
                  touches ideas you've already checked. Excluded ideas are hidden from retrieval but kept
                  (reversible), never deleted.
                </p>
                {#if ideasNeedingSourceLink > 0}
                  <p class="revalidate-note brut-muted">
                    {ideasNeedingSourceLink.toLocaleString()} idea
                    {ideasNeedingSourceLink === 1 ? "" : "s"} lack linked source text — run
                    <strong>Find sources for ideas</strong> first for better remediation coverage.
                  </p>
                {/if}
                {#if revalidateOptions.embedReady === false}
                  <p class="revalidate-note brut-muted">
                    Embedding route not configured — repaired ideas will validate but may not re-embed until you publish an
                    embedding route.
                  </p>
                {/if}
                <div class="revalidate-form">
                  <label class="revalidate-field" for="auto-remediate-validation-route">
                    <span class="revalidate-label">Validation route</span>
                    <select
                      id="auto-remediate-validation-route"
                      class="revalidate-input brut-focus"
                      bind:value={revalidateRouteId}
                      disabled={autoRemediating}
                    >
                      {#if (revalidateOptions?.routes ?? []).length === 0}
                        <option value="">Workspace default</option>
                      {:else}
                        <option value="">Workspace default routing</option>
                        {#each revalidateOptions?.routes ?? [] as route (route.id)}
                          <option value={route.id}>
                            {route.name}{route.isDefault ? " (workspace default)" : ""}
                          </option>
                        {/each}
                      {/if}
                    </select>
                  </label>
                  <label class="revalidate-field" for="auto-remediate-remediation-route">
                    <span class="revalidate-label">Remediation route</span>
                    <select
                      id="auto-remediate-remediation-route"
                      class="revalidate-input brut-focus"
                      bind:value={remediationRouteId}
                      disabled={autoRemediating}
                    >
                      {#if (revalidateOptions?.remediationRoutes ?? []).length === 0}
                        <option value="">Workspace default</option>
                      {:else}
                        <option value="">Workspace default routing</option>
                        {#each revalidateOptions?.remediationRoutes ?? [] as route (route.id)}
                          <option value={route.id}>
                            {route.name}{route.isDefault ? " (workspace default)" : ""}
                          </option>
                        {/each}
                      {/if}
                    </select>
                  </label>
                  <label class="revalidate-field" for="auto-remediate-strictness">
                    <span class="revalidate-label">Strictness</span>
                    <select
                      id="auto-remediate-strictness"
                      class="revalidate-input brut-focus"
                      bind:value={remediateStrictness}
                      disabled={autoRemediating}
                    >
                      <option value="conservative">Conservative — repair only, never remove</option>
                      <option value="balanced">Balanced — repair + remove baseless ideas</option>
                      <option value="strict">Strict — repair, remove all still-unsupported</option>
                    </select>
                  </label>
                  <label class="revalidate-field" for="auto-remediate-threshold">
                    <span class="revalidate-label">
                      Confidence threshold {remediateThreshold == null ? "(level default)" : `(${remediateThreshold})`}
                    </span>
                    <input
                      id="auto-remediate-threshold"
                      class="revalidate-input brut-focus"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={remediateThreshold ?? { conservative: 0.8, balanced: 0.6, strict: 0.4 }[remediateStrictness]}
                      disabled={autoRemediating}
                      on:input={(e) => (remediateThreshold = Number((e.currentTarget as HTMLInputElement).value))}
                    />
                  </label>
                  <label class="revalidate-field" for="auto-remediate-batch">
                    <span class="revalidate-label">Batch size (ideas per run)</span>
                    <input
                      id="auto-remediate-batch"
                      class="revalidate-input brut-focus"
                      type="number"
                      min="1"
                      max="100000"
                      step="50"
                      bind:value={remediateBatchSize}
                      disabled={autoRemediating}
                    />
                  </label>
                </div>
                <label class="revalidate-check brut-focus" for="auto-remediate-continue">
                  <input
                    id="auto-remediate-continue"
                    type="checkbox"
                    bind:checked={remediateContinueInBackground}
                    disabled={autoRemediating}
                  />
                  <span>Keep remediating in the background until the selected scope is clear</span>
                </label>
                <div class="revalidate-route-links" aria-label="Route management">
                  <a class="revalidate-link brut-focus" href={modelsManageHref}>Manage ingest routes</a>
                  {#if validationRouteEditHref}
                    <a class="revalidate-link brut-focus" href={validationRouteEditHref}>
                      Edit validation route
                      {#if selectedValidationRoute?.activeModel}
                        ({selectedValidationRoute.activeModel.provider}/{selectedValidationRoute.activeModel.modelId})
                      {/if}
                    </a>
                  {/if}
                  {#if remediationRouteEditHref}
                    <a class="revalidate-link brut-focus" href={remediationRouteEditHref}>
                      Edit remediation route
                      {#if selectedRemediationRoute?.activeModel}
                        ({selectedRemediationRoute.activeModel.provider}/{selectedRemediationRoute.activeModel.modelId})
                      {/if}
                    </a>
                  {/if}
                </div>
                <p class="revalidate-note brut-muted">
                  Route picks apply only to this run — your saved workspace ingestion routes stay unchanged.
                </p>
                <p class="revalidate-note brut-muted">
                  Use a remediation route with at least two enabled steps (or a pool) if you rely on model failover after
                  upstream errors.
                </p>
                {#if revalidateError}
                  <BrutalErrorBanner title="Auto-remediation not started" message={revalidateError} />
                {/if}
                <div class="revalidate-actions">
                  {#if quarantineCount > 0}
                    <button
                      type="button"
                      class="brutal-btn brut-pressable brut-focus brut-fill-neon revalidate-btn"
                      disabled={autoRemediating}
                      on:click={() => startAutoRemediation("quarantine")}
                    >
                      {autoRemediating ? "Starting…" : `Auto-remediate quarantine (${quarantineCount.toLocaleString()})`}
                    </button>
                  {/if}
                  {#if unsupportedUntriagedCount > 0}
                    <button
                      type="button"
                      class="brutal-btn brut-pressable brut-focus brut-fill-blue revalidate-btn"
                      disabled={autoRemediating}
                      on:click={() => startAutoRemediation("unsupported")}
                    >
                      Unsupported only ({unsupportedUntriagedCount.toLocaleString()})
                    </button>
                  {/if}
                  <p class="revalidate-note brut-muted">
                    Processes up to {remediateBatchSize.toLocaleString()} flagged idea{remediateBatchSize === 1 ? "" : "s"} per run
                    {remediateContinueInBackground ? " (auto-continues until the scope is clear)" : ""}. Opens the ingest run console.
                  </p>
                </div>
              </BrutalCard>
            </div>
          {:else}
            <div class="revalidate-panel">
              <BrutalCard fill="canvas" title="Auto-remediate quarantine">
                <p class="revalidate-lede brut-muted">
                  Nothing to remediate — every idea checked so far is supported. Flagged
                  (weak/unsupported) ideas will appear here for repair or removal as you validate more.
                </p>
              </BrutalCard>
            </div>
          {/if}
        {:else}
          <BrutalCard fill="canvas" title="Auto-remediation">
            <p class="brut-muted">
              Connect LLM routing and a graph store in Pipeline to re-validate and remediate quarantined ideas.
            </p>
            <BrutalButton variant="blue" href={pipelineWizardHref("launch")}>Pipeline setup</BrutalButton>
          </BrutalCard>
        {/if}
      </div>
    {/if}
    </div>
  {/if}
</div>

<style>
  .connect-graph-explorer {
    max-width: 72rem;
  }

  .bento-stat {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-display-metric-sm);
    font-weight: 900;
    letter-spacing: var(--text-display-tracking);
    line-height: var(--text-display-line-height);
  }

  .bento-stat--calculating {
    opacity: 0.35;
    animation: bento-stat-pulse 1.4s ease-in-out infinite;
  }

  @keyframes bento-stat-pulse {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 0.65; }
  }

  .bento-stat-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .bento-stat-hint {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    color: color-mix(in oklab, var(--brut-ink) 55%, transparent);
    line-height: 1.3;
  }

  :global(.brut-fill-blue) .bento-stat-hint,
  :global(.brut-fill-neon) .bento-stat-hint {
    color: color-mix(in oklab, var(--brut-ink) 72%, transparent);
  }

  .bento-stat-btn {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }

  .bento-stat-btn:disabled {
    cursor: default;
    opacity: 1;
  }

  .bento-stat-btn:not(:disabled):hover .bento-stat,
  .bento-stat-btn:not(:disabled):focus-visible .bento-stat {
    text-decoration: underline;
    text-decoration-thickness: 3px;
  }

  .validation-breakdown {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }

  @media (max-width: 700px) {
    .validation-breakdown {
      grid-template-columns: 1fr;
    }
  }

  .validation-breakdown li {
    display: flex;
    min-height: 0;
  }

  .vb-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    border: var(--brut-border-micro) solid var(--brut-ink);
    padding: var(--space-3) var(--space-4);
    background: var(--brut-white);
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: inherit;
    box-shadow: var(--brut-shadow-sm);
    transition: var(--brut-transition);
  }

  .vb-stat:hover,
  .vb-stat:focus-visible {
    box-shadow: var(--brut-shadow-hover);
    transform: translate(2px, 2px);
  }

  .vb-stat--verdict-ok {
    border-left: 6px solid var(--brut-blue);
    background: color-mix(in srgb, var(--brut-blue) 10%, var(--brut-white));
  }

  .vb-stat--verdict-weak {
    border-left: 6px solid var(--color-yellow);
    background: repeating-linear-gradient(
      -45deg,
      color-mix(in srgb, var(--color-yellow) 32%, var(--brut-white)),
      color-mix(in srgb, var(--color-yellow) 32%, var(--brut-white)) 8px,
      var(--brut-white) 8px,
      var(--brut-white) 16px
    );
  }

  .vb-stat--verdict-unsupported {
    border-left: 6px solid var(--brut-coral, #e85d4c);
    background: color-mix(in srgb, var(--brut-coral, #e85d4c) 16%, var(--brut-white));
    box-shadow: 4px 4px 0 color-mix(in srgb, var(--brut-coral, #e85d4c) 55%, var(--brut-ink));
  }

  .vb-label {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-muted);
  }

  .review-hint {
    margin: var(--space-3) 0 0;
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .review-hint-actions {
    margin-top: var(--space-2);
    font-size: var(--text-xs);
  }

  .queue-count-live {
    margin: var(--space-2) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }

  /* W4.2 — Stamping Desk entry + mount. */
  .desk-enter-row {
    margin: var(--space-2) 0 0;
  }

  .desk-enter {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
  }

  .desk-enter-hint {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-ink-faint);
  }

  .desk-enter-disabled {
    margin: 0;
    font-size: var(--text-sm);
  }

  .desk-mount {
    margin-bottom: var(--space-4);
  }

  /* C-P2-1: dismissible context line shown on CTA arrival with ?filter=review */
  .cta-context-line {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    justify-content: space-between;
    margin: var(--space-3) 0 0;
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--color-yellow);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
  }

  .cta-context-dismiss {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    padding: 0 var(--space-1);
    line-height: 1;
  }

  .cta-context-dismiss:hover {
    color: var(--color-ink);
  }

  .graph-workspace {
    margin-top: var(--space-4);
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    box-shadow: var(--brut-shadow);
  }

  .graph-flow-map {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-canvas);
  }

  .graph-flow-caption {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.45;
    max-width: 42rem;
  }

  .graph-flow-svg {
    display: block;
    max-width: 32rem;
  }

  .graph-flow-svg .flow-box {
    fill: var(--brut-white);
    stroke: var(--brut-ink);
    stroke-width: 2;
  }

  .graph-flow-svg .flow-box-active {
    fill: var(--color-yellow);
  }

  .graph-flow-svg .flow-line {
    stroke: var(--brut-ink);
    stroke-width: 2;
  }

  .graph-flow-svg .flow-text {
    fill: var(--brut-ink);
    font-size: 11px;
    font-weight: 800;
    font-family: inherit;
  }

  .graph-flow-svg .flow-sub {
    fill: var(--brut-muted);
    font-size: 9px;
    font-family: inherit;
  }

  .workspace-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .workspace-tab {
    min-height: 44px;
    padding: 0.5rem 1rem;
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-canvas);
    color: var(--brut-ink);
    cursor: pointer;
    box-shadow: var(--brut-shadow-sm);
    transition: var(--brut-transition);
  }

  .workspace-tab:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .workspace-tab-active {
    background: var(--color-ink);
    color: var(--color-surface);
    box-shadow: var(--brut-shadow-none);
    transform: translate(3px, 3px);
  }

  .workspace-tab-meta {
    margin-left: 0.35rem;
    opacity: 0.7;
  }

  .workspace-alerts {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) 0;
  }

  .graph-workspace > .graph-layout,
  .graph-workspace > .clusters-layout,
  .graph-workspace > .tools-panel {
    padding: var(--space-4);
  }

  .scope-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--color-surface);
    font-size: var(--text-sm);
  }

  .scope-banner p {
    margin: 0;
  }

  .scope-clear {
    min-height: 44px;
    padding: 0.375rem 0.75rem;
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    cursor: pointer;
  }

  .clusters-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 1.05fr);
    gap: var(--space-4);
    align-items: start;
  }

  @media (max-width: 960px) {
    .clusters-layout {
      grid-template-columns: 1fr;
    }
  }

  .cluster-search-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
  }

  .cluster-search-label {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-muted);
  }

  .cluster-search-input {
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    font: inherit;
    font-size: var(--text-sm);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .cluster-index-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 28rem;
    overflow: auto;
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-ink);
    padding: var(--brut-border-width);
  }

  .cluster-card {
    width: 100%;
    text-align: left;
    padding: var(--space-3);
    border: none;
    background: var(--brut-canvas);
    color: var(--brut-ink);
    cursor: pointer;
    font: inherit;
    box-shadow: var(--brut-shadow-sm);
    transition: var(--brut-transition);
  }

  .cluster-card:hover {
    box-shadow: var(--brut-shadow-hover);
    transform: translate(2px, 2px);
  }

  .cluster-card-selected {
    background: var(--brut-blue);
    color: var(--brut-white);
    box-shadow: var(--brut-shadow-none);
    transform: translate(4px, 4px);
  }

  .cluster-card-selected .brut-muted,
  .cluster-card-selected .cluster-card-summary,
  .cluster-card-selected .cluster-card-linked {
    color: color-mix(in oklab, var(--brut-white) 85%, transparent);
  }

  .cluster-card-top {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    align-items: baseline;
    margin-bottom: var(--space-1);
  }

  .cluster-card-name {
    font-size: var(--text-sm);
  }

  .cluster-card-count {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .cluster-card-summary {
    margin: 0 0 var(--space-1);
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--brut-muted);
  }

  .cluster-card-linked {
    margin: 0;
    font-size: var(--text-xs);
  }

  .cluster-detail-summary {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .cluster-detail-meta {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }

  .cluster-detail-actions {
    margin-bottom: var(--space-3);
  }

  .cluster-detail-actions .brutal-btn {
    width: 100%;
    min-height: 44px;
  }

  .member-list-interactive {
    max-height: 20rem;
    overflow: auto;
    border: var(--brut-border-micro) solid var(--brut-ink);
    padding: var(--brut-border-width);
    background: var(--brut-canvas);
  }

  .member-row {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: baseline;
    justify-content: space-between;
    padding: var(--space-2);
    border: none;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    text-align: left;
    cursor: pointer;
    font: inherit;
    font-size: var(--text-xs);
  }

  .member-row:last-child {
    border-bottom: none;
  }

  .member-row:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .member-row:not(:disabled):hover,
  .member-row:not(:disabled):focus-visible {
    background: var(--color-bg-deep);
  }

  .member-row-text {
    flex: 1;
    min-width: 0;
    line-height: 1.4;
  }

  .tools-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 48rem;
  }

  .tools-panel .graph-glossary {
    margin-top: 0;
  }

  .graph-glossary {
    margin-top: var(--space-4);
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    box-shadow: var(--brut-shadow-sm);
  }

  .graph-glossary-summary {
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    list-style: none;
  }

  .graph-glossary-summary::-webkit-details-marker {
    display: none;
  }

  .graph-glossary-summary::before {
    content: "▸ ";
    display: inline-block;
    transition: transform 0.15s ease;
  }

  .graph-glossary[open] .graph-glossary-summary::before {
    transform: rotate(90deg);
  }

  .graph-glossary-body {
    padding: 0 var(--space-4) var(--space-4);
    border-top: var(--brut-border-micro) solid var(--brut-ink);
  }

  .graph-glossary-lede {
    margin: var(--space-3) 0 var(--space-4);
    font-size: var(--text-sm);
    line-height: 1.45;
    max-width: 40rem;
  }

  .glossary-section + .glossary-section {
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px dashed var(--rm-border);
  }

  .glossary-section-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rm-muted);
  }

  .glossary-dl {
    margin: 0;
  }

  .glossary-row {
    display: grid;
    grid-template-columns: minmax(6.5rem, 9rem) 1fr;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-2) 0;
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .glossary-row dt {
    margin: 0;
    font-weight: 800;
  }

  .glossary-row dd {
    margin: 0;
    color: var(--rm-muted);
  }

  @media (max-width: 520px) {
    .glossary-row {
      grid-template-columns: 1fr;
      gap: 0.125rem;
    }
  }

  .filter-hint {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
  }

  .glossary-jump {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: inherit;
    color: var(--rm-link, var(--rm-text));
    text-decoration: underline;
    cursor: pointer;
  }

  .revalidate-panel {
    margin-top: var(--space-4);
  }

  .readiness-active-run {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-left-width: 4px;
    background: color-mix(in oklab, var(--brut-neon, #e8ff47) 18%, var(--brut-white));
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .readiness-active-clear {
    margin-left: var(--space-2);
    font: inherit;
    font-weight: 700;
    color: var(--color-ink);
    background: none;
    border: none;
    padding: 0.1rem 0.3rem;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .readiness-active-clear:hover,
  .readiness-active-clear:focus-visible {
    background: var(--brut-neon, #e8ff47);
    outline: none;
  }

  .cohort-complete-panel {
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: color-mix(in oklab, var(--brut-neon, #e8ff47) 20%, var(--brut-white));
    box-shadow: var(--brut-shadow-sm);
    padding: var(--space-4) var(--space-5);
  }

  .cohort-complete-kicker {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: color-mix(in oklab, var(--color-ink) 70%, transparent);
  }

  .cohort-complete-title {
    margin: 0 0 var(--space-2);
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
  }

  .cohort-complete-lede {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.5;
    max-width: 60ch;
  }

  .cohort-complete-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .readiness-blocker-list {
    margin: 0 0 var(--space-3);
    padding-left: 1.25rem;
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .readiness-blocker-list li + li {
    margin-top: var(--space-1);
  }

  .revalidate-lede {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .revalidate-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .source-pack-mapping-panel {
    margin-bottom: var(--space-3);
    padding: var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .source-pack-mapping-summary {
    cursor: pointer;
    list-style: none;
    margin-bottom: var(--space-2);
  }

  .source-pack-mapping-summary::-webkit-details-marker {
    display: none;
  }

  .source-pack-mapping-pack {
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
  }

  .source-pack-mapping-form {
    margin-top: var(--space-2);
  }

  .source-pack-sync-panel {
    margin-bottom: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px dashed var(--brut-border);
  }

  .source-pack-sync-changes {
    margin: 0 0 var(--space-2);
    padding-left: 1.25rem;
    font-size: var(--text-xs);
  }

  .revalidate-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .revalidate-check {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.4;
  }
  .revalidate-check input {
    margin-top: 0.2em;
  }

  .revalidate-label {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-muted);
  }

  .revalidate-input {
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    font: inherit;
    font-size: var(--text-sm);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .revalidate-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .revalidate-btn {
    width: fit-content;
    min-width: 12rem;
  }

  .revalidate-note {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.4;
  }

  .revalidate-route-links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    margin: 0 0 var(--space-3);
  }

  .revalidate-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink);
    text-decoration: underline;
  }

  .revalidate-link:hover {
    color: var(--color-accent);
  }

  .source-catalog-stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .source-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 6rem;
  }
  .source-stat-n {
    font-family: var(--font-mono);
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--color-ink);
  }
  .source-stat-label {
    font-size: var(--text-xs);
    color: var(--brut-muted-text, var(--color-ink));
    opacity: 0.7;
  }
  .source-stat-ok .source-stat-n { color: var(--color-accent, #2ecc71); }
  .source-stat-warn .source-stat-n { color: var(--color-warning, #e67e22); }
  .source-import-result {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--brut-border);
    border-radius: var(--brut-radius, 2px);
    font-size: var(--text-xs);
    color: var(--brut-muted-text, var(--color-ink));
  }
  .source-no-text-detail {
    margin-top: var(--space-3);
  }
  .source-no-text-detail summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .source-no-text-detail summary::-webkit-details-marker { display: none; }
  .source-no-text-list {
    margin: var(--space-2) 0 0 var(--space-4);
    padding: 0;
    font-size: var(--text-xs);
    line-height: 1.6;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .bento-stat-hint--warn {
    color: var(--color-warning, var(--brut-ink));
    font-weight: 700;
  }

  .embed-preview {
    margin: 0 0 var(--space-3);
  }

  .embed-preview-list {
    margin: var(--space-2) 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 12rem;
    overflow: auto;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .embed-preview-item {
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--brut-border-micro) solid var(--brut-line, var(--brut-ink));
  }

  .embed-preview-item:last-child {
    border-bottom: none;
  }

  .embed-preview-text {
    display: block;
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--color-ink);
  }

  .empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }

  .graph-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
    gap: var(--space-4);
    align-items: start;
  }

  @media (max-width: 960px) {
    .graph-layout {
      grid-template-columns: 1fr;
    }
  }

  .panel-head {
    margin-bottom: var(--space-3);
  }

  .panel-title {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
  }

  .panel-lede {
    margin: 0;
    font-size: var(--text-sm);
  }

  .units-load-meta {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-ink-muted, var(--color-muted));
  }

  .load-more-units {
    margin-top: var(--space-2);
  }

  .load-more-error {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
    color: var(--rm-status-danger, #b42318);
  }

  .queue-filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    padding: var(--space-2);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-canvas);
    box-shadow: var(--brut-shadow-sm);
  }

  .queue-filter-scope,
  .queue-filter-verdicts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: stretch;
  }

  .queue-filter-divider {
    width: 2px;
    align-self: stretch;
    min-height: 2.75rem;
    background: var(--brut-ink);
    opacity: 0.2;
    margin: 0 var(--space-1);
  }

  @media (max-width: 640px) {
    .queue-filter-divider {
      width: 100%;
      height: 2px;
      min-height: 0;
      margin: var(--space-1) 0;
    }
  }

  .queue-filter {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: 0.375rem 0.75rem;
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
    cursor: pointer;
    box-shadow: var(--brut-shadow-sm);
    transition: var(--brut-transition);
  }

  .queue-filter:hover:not(:disabled) {
    box-shadow: var(--brut-shadow);
    transform: translate(1px, 1px);
  }

  .queue-filter:disabled,
  .queue-filter--inactive {
    opacity: 0.38;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
    background: var(--brut-canvas);
  }

  .queue-filter--inactive .queue-filter-swatch {
    box-shadow: none;
    opacity: 0.65;
  }

  .queue-filter--scope.queue-filter-active {
    background: var(--color-ink);
    color: var(--color-surface);
    box-shadow: var(--brut-shadow-hover);
    transform: translate(2px, 2px);
  }

  .queue-filter-swatch {
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid var(--brut-ink);
    box-shadow: 2px 2px 0 var(--brut-ink);
    flex-shrink: 0;
  }

  .queue-filter--ok .queue-filter-swatch {
    background: color-mix(in srgb, var(--brut-blue) 55%, var(--brut-white));
  }

  .queue-filter--weak .queue-filter-swatch {
    background: repeating-linear-gradient(
      -45deg,
      var(--color-yellow),
      var(--color-yellow) 6px,
      var(--brut-white) 6px,
      var(--brut-white) 12px
    );
  }

  .queue-filter--unsupported .queue-filter-swatch {
    background: color-mix(in srgb, var(--brut-coral, #e85d4c) 72%, var(--brut-white));
  }

  .queue-filter--ok.queue-filter-active {
    background: color-mix(in srgb, var(--brut-blue) 28%, var(--color-surface));
    border-left: 4px solid var(--brut-blue);
    box-shadow: 4px 4px 0 color-mix(in srgb, var(--brut-blue) 45%, var(--brut-ink));
    transform: translate(2px, 2px);
  }

  .queue-filter--weak.queue-filter-active {
    background: var(--color-surface);
    border-left: 4px solid var(--color-yellow);
    box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-yellow) 55%, var(--brut-ink));
    transform: translate(2px, 2px);
  }

  .queue-filter--unsupported.queue-filter-active {
    background: color-mix(in srgb, var(--brut-coral, #e85d4c) 30%, var(--color-surface));
    border-left: 4px solid var(--brut-coral, #e85d4c);
    box-shadow: 4px 4px 0 color-mix(in srgb, var(--brut-coral, #e85d4c) 55%, var(--brut-ink));
    transform: translate(2px, 2px);
  }

  .queue-filter-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    margin-left: 0.15rem;
    padding: 0 0.25rem;
    background: var(--brut-ink);
    color: var(--brut-neon);
    font-size: 0.625rem;
  }

  .queue-filter-status {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .filter-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    margin-left: 0.35rem;
    padding: 0 0.25rem;
    background: var(--brut-ink);
    color: var(--brut-neon);
    font-size: 0.625rem;
  }

  .unit-list {
    list-style: none;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 36rem;
    overflow: auto;
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-ink);
    padding: var(--brut-border-width);
  }

  .review-guidance {
    margin: var(--space-3) 0;
    padding: var(--space-3);
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    box-shadow: var(--brut-shadow-sm);
  }

  .review-guidance-weak {
    border-left: 4px solid var(--brut-neon);
    background: repeating-linear-gradient(
      -45deg,
      color-mix(in srgb, var(--color-yellow) 22%, var(--brut-white)),
      color-mix(in srgb, var(--color-yellow) 22%, var(--brut-white)) 8px,
      var(--brut-white) 8px,
      var(--brut-white) 16px
    );
  }

  .review-guidance-unsupported {
    border-left: 4px solid var(--brut-coral, #e85d4c);
    background: color-mix(in srgb, var(--brut-coral, #e85d4c) 12%, var(--brut-white));
  }

  .review-guidance-ok {
    border-left: 4px solid var(--brut-blue);
    background: color-mix(in srgb, var(--brut-blue) 8%, var(--brut-white));
  }

  .review-guidance-unknown {
    border-left: 4px dashed var(--brut-muted);
    background: var(--brut-canvas);
  }

  .review-guidance-kicker {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-muted);
  }

  .review-guidance-headline {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 800;
    line-height: 1.35;
  }

  .review-guidance-detail {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .review-guidance-hint {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: var(--brut-muted);
  }

  .review-coaching-expander {
    margin-top: var(--space-3);
    border: var(--border-thin);
    background: var(--color-bg);
  }

  .review-coaching-summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: var(--space-2) var(--space-3);
    min-height: 44px;
  }

  .review-coaching-summary-label::before {
    content: "► ";
  }

  .review-coaching-expander[open] .review-coaching-summary-label::before {
    content: "▼ ";
  }

  .review-coaching-summary::-webkit-details-marker {
    display: none;
  }

  .review-coaching-body {
    padding: 0 var(--space-3) var(--space-3);
    margin-left: var(--space-2);
    border-left: 3px solid var(--color-ink-faint);
  }

  .review-coaching-badge {
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    padding: 0.125rem 0.375rem;
    border: 2px solid var(--brut-ink);
    background: transparent;
    color: var(--brut-ink);
  }

  .review-coaching-lede {
    margin: 0 0 var(--space-1);
    font-size: var(--text-sm);
    font-weight: 600;
    line-height: 1.45;
  }

  .review-coaching-note {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    line-height: 1.4;
  }

  .review-coaching-loading,
  .review-coaching-error {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
  }

  .review-coaching-error {
    color: var(--rm-status-danger, #b42318);
  }

  .review-coaching-block {
    margin: 0 0 var(--space-3);
  }

  .review-coaching-label {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--brut-muted);
  }

  .review-coaching-steps,
  .review-coaching-checks {
    margin: 0;
    padding-left: 1.25rem;
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .review-coaching-steps li + li,
  .review-coaching-checks li + li {
    margin-top: var(--space-1);
  }

  .review-actions .review-action-btn {
    width: 100%;
    min-height: 44px;
    padding: 0.5rem 1rem;
    font-family: inherit;
    font-size: inherit;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: var(--brut-border-width) solid var(--brut-ink);
    box-shadow: var(--brut-shadow-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .review-actions .brutal-btn-primary {
    background: var(--color-yellow);
    box-shadow: var(--shadow-sm);
  }

  .review-actions .brutal-btn-outline {
    background: var(--brut-white);
  }

  .review-btn-key {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--color-ink-faint);
    flex-shrink: 0;
  }

  .review-actions .brutal-btn-primary .review-btn-key {
    color: color-mix(in oklab, var(--color-ink) 55%, transparent);
  }

  .review-btn-flash {
    background: var(--color-yellow) !important;
  }

  .review-actions .review-btn-suggested {
    box-shadow: var(--brut-shadow);
  }

  .review-actions .brutal-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }

  .remove-section {
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: var(--brut-border-width) dashed var(--brut-ink);
  }

  .remove-lede {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    line-height: 1.45;
  }

  .remove-btn {
    width: 100%;
    min-height: 44px;
    padding: 0.5rem 1rem;
    font-family: inherit;
    font-size: inherit;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
  }

  .remove-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }

  .unit-row {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0;
    border: var(--border);
    border-left-width: 4px;
    background: var(--brut-white);
    color: var(--brut-ink);
    cursor: pointer;
    font: inherit;
    box-shadow: var(--brut-shadow);
    transition:
      transform 200ms ease-in,
      opacity 150ms ease-in,
      box-shadow 80ms ease,
      border-color 80ms ease;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .unit-row {
      transition: opacity 75ms ease;
    }
    .unit-row-exiting {
      transform: none !important;
    }
  }

  .unit-row:hover {
    box-shadow: var(--shadow-lg);
    transform: translate(-2px, -2px);
  }

  .unit-row-selected {
    border: var(--border);
    border-left-width: 4px;
    box-shadow: var(--shadow-md);
    transform: none;
  }

  .unit-row-exiting {
    transform: translateX(-100%);
    opacity: 0;
    pointer-events: none;
  }

  .unit-status-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border: var(--border-thin);
    background: transparent;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
  }

  /* W2.5 — prior-version row badge: a neutral, non-verdict label (verdict not historical). */
  .unit-status-badge--historical {
    border-style: dashed;
    color: var(--color-ink-muted, var(--color-ink));
    text-transform: none;
    letter-spacing: 0;
  }

  .unit-row-inner {
    position: relative;
    display: block;
    padding: var(--space-2) var(--space-3);
    background: var(--verdict-surface, var(--color-surface));
    min-width: 0;
  }

  .unit-row--verdict-ok {
    border-left-color: color-mix(in srgb, var(--brut-blue) 55%, transparent);
    --verdict-surface: var(--color-surface);
  }

  .unit-row--verdict-weak {
    border-left-color: var(--color-yellow);
    --verdict-surface: var(--color-surface);
  }

  .unit-row--verdict-unsupported {
    border-left-color: var(--brut-coral, #e85d4c);
    --verdict-surface: var(--color-surface);
  }

  .unit-row--verdict-unknown {
    border-left-color: transparent;
    --verdict-surface: var(--color-bg);
    border-style: dashed;
  }

  .unit-row-top {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-2);
    position: relative;
    z-index: 1;
  }

  .unit-meta {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-ink);
  }

  .unit-domain {
    opacity: 0.65;
  }

  .unit-row-text {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    position: relative;
    z-index: 1;
  }

  .unit-provenance {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    line-height: 1.35;
    color: var(--brut-muted);
  }

  .prov-author {
    font-weight: 800;
    color: var(--brut-ink);
  }

  .prov-sep {
    margin: 0 0.25rem;
  }

  .prov-source {
    font-style: italic;
  }

  .provenance-block {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
  }

  .provenance-label {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-muted);
  }

  .provenance-body {
    margin: 0;
  }

  .prov-row {
    margin: 0;
    display: grid;
    grid-template-columns: 4.5rem minmax(0, 1fr);
    gap: var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.4;
  }

  .prov-row + .prov-row {
    margin-top: var(--space-1);
  }

  .prov-key {
    font-weight: 800;
    text-transform: uppercase;
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    color: var(--brut-muted);
  }

  .prov-value {
    min-width: 0;
    word-break: break-word;
  }

  .prov-link {
    color: var(--brut-ink);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  .prov-link:hover {
    color: var(--brut-blue);
  }

  .detail-text {
    margin: 0 0 var(--space-3);
    font-size: var(--text-base);
    line-height: 1.5;
    font-weight: 600;
  }

  .detail-badges {
    margin-bottom: var(--space-2);
  }

  /* W2.5 — note on a historical (prior-version) selected idea. */
  .detail-historical-note {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  /* W2.5 — honest projection summary shown in place of the (current-only) bento under as-of. */
  .as-of-projection-summary {
    margin: var(--space-2) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
  }

  .ai-note {
    border: var(--brut-border-micro) solid var(--brut-ink);
    padding: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .ai-note-label {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .ai-note-body {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .note-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
  }

  .note-label {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .note-input {
    width: 100%;
    min-height: 4.5rem;
    padding: var(--space-2) var(--space-3);
    font-family: inherit;
    font-size: var(--text-sm);
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-radius: 0;
    background: var(--brut-white);
    resize: vertical;
  }

  .review-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .member-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-xs);
  }

  .member-list li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    align-items: baseline;
  }

  .member-role {
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .queue-pager {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    padding: var(--space-2);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .queue-pager-foot {
    margin-top: var(--space-3);
    margin-bottom: 0;
  }

  .queue-pager-btn {
    min-height: 44px;
    min-width: 5.5rem;
    padding: 0.375rem 0.75rem;
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-canvas);
    cursor: pointer;
    box-shadow: var(--brut-shadow-sm);
  }

  .queue-pager-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }

  .queue-pager-status {
    font-size: var(--text-sm);
    font-weight: 800;
  }

  .queue-off-page {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }

  .cluster-relations {
    margin: var(--space-4) 0;
    padding-top: var(--space-3);
    border-top: var(--brut-border-width) dashed var(--brut-ink);
  }

  .cluster-relations-title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .cluster-relations-lede {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    line-height: 1.4;
  }

  .relations-preview-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .relation-edge {
    border: var(--brut-border-micro) solid var(--brut-ink);
    padding: var(--space-2);
    background: var(--brut-canvas);
    box-shadow: var(--brut-shadow-sm);
  }

  .relation-type {
    display: inline-block;
    margin-bottom: var(--space-1);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--brut-blue);
  }

  .relation-claims {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem 0.5rem;
    font-size: var(--text-xs);
    line-height: 1.4;
  }

  .relation-arrow {
    font-weight: 900;
    opacity: 0.65;
  }

  .relation-claim {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: inherit;
    color: var(--brut-ink);
    text-align: left;
    text-decoration: underline;
    cursor: pointer;
    max-width: 100%;
  }

  .relation-claim-static {
    opacity: 0.85;
  }

  .relations-more {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ── Evidence facet (W2.2) ─────────────────────────────────────────────── */
  .evidence-facet-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-2) 0 0;
  }
  .evidence-facet-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink-muted);
  }
  .evidence-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border: var(--border-thin);
    background: var(--color-surface);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink);
    cursor: pointer;
  }
  .evidence-chip-count {
    font-weight: 700;
  }
  .evidence-chip--supported {
    border-left: 4px solid var(--color-yellow);
  }
  .evidence-chip--inferred {
    border-left: 4px solid var(--color-ink-muted);
  }
  .evidence-chip--unverified {
    border-left: 4px dashed var(--color-ink);
  }
  .evidence-chip--contradicted {
    border-left: 4px solid var(--brut-coral);
  }
  .evidence-chip--excluded {
    border-left: 4px dotted var(--color-ink-faint);
    color: var(--color-ink-muted);
  }
  .evidence-chip-active {
    background: var(--color-ink);
    color: var(--color-bg);
  }
  .evidence-facet-note {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
  }

  /* ── Evidence Dossier panel (W2.2) ─────────────────────────────────────── */
  .dossier {
    margin: var(--space-3) 0 0;
    padding-top: var(--space-3);
    border-top: 2px dashed var(--color-ink);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .dossier-stamp-row {
    display: flex;
  }
  .dossier-stamp {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-1) var(--space-3);
    border: 2px solid var(--color-ink);
    transform: rotate(-1.5deg);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    background: var(--color-surface);
  }
  .dossier-stamp-text {
    font-size: var(--text-mono-md);
    font-weight: 700;
  }
  .dossier-stamp-date {
    font-size: var(--text-mono-sm);
    border-top: 1px solid currentColor;
    padding-top: 2px;
  }
  .dossier-stamp--supported {
    background: var(--color-yellow);
    color: var(--color-ink);
  }
  .dossier-stamp--contradicted {
    border-color: var(--brut-coral);
    color: var(--brut-coral);
    background: var(--color-surface);
  }
  .dossier-stamp--inferred {
    background: var(--color-surface);
  }
  .dossier-stamp--unverified {
    border-style: dashed;
  }
  .dossier-stamp--excluded {
    color: var(--color-ink-faint);
    border-color: var(--color-ink-faint);
  }
  .dossier-stamp--pre-ebv {
    border-style: dotted;
    color: var(--color-ink-muted);
  }
  .dossier-empty,
  .dossier-loading,
  .dossier-error,
  .dossier-guard-note,
  .dossier-rejudge-note {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink-muted);
  }
  .dossier-error,
  .dossier-action-error {
    color: var(--brut-coral);
  }
  .dossier-action-error {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
  }

  .evidence-card {
    margin: 0;
    border: 2px solid var(--color-ink);
    box-shadow: var(--shadow-sm);
    background: var(--color-bg);
  }
  .evidence-card-cap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    background: var(--color-ink);
    color: var(--color-bg);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
  }
  .evidence-card-source {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .evidence-card-open {
    color: var(--color-yellow);
    white-space: nowrap;
    text-decoration: none;
    /* W4.5 a11y: ≥44px target (X10, #291) — the "open source ↗" evidence link. */
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .evidence-card-open:hover {
    text-decoration: underline;
  }
  .evidence-card-body {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.5;
  }
  .evidence-ctx {
    color: var(--color-ink-faint);
  }
  .evidence-mark {
    background: var(--color-yellow);
    color: var(--color-ink);
    padding: 0 2px;
  }
  .evidence-note {
    margin: 0;
    padding: 0 var(--space-3) var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink-muted);
  }

  .custody {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
  }
  .custody-hop {
    border-bottom: 1px dotted var(--color-ink);
    cursor: help;
  }
  .custody-arrow {
    color: var(--color-ink-faint);
  }

  .dossier-recheck {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .dossier-recheck-hint {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
  }
  .recheck-result {
    border: var(--border-thin);
    padding: var(--space-2);
    background: var(--color-surface);
  }
  .recheck-result.recheck-pass {
    border-left: 4px solid var(--color-yellow);
  }
  .recheck-result.recheck-fail {
    border-left: 4px solid var(--brut-coral);
  }
  .recheck-headline {
    margin: 0 0 2px;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
  }
  .recheck-fail .recheck-headline {
    color: var(--brut-coral);
  }
  .recheck-detail {
    margin: 0;
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
  }

  .dossier-versions {
    border: var(--border-thin);
    background: var(--color-surface);
  }
  .dossier-versions-summary {
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    cursor: pointer;
  }
  .version-list {
    list-style: none;
    margin: 0;
    padding: 0 var(--space-2) var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .version-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
  }
  .version-row.version-current .version-no {
    background: var(--color-yellow);
  }
  .version-no {
    font-weight: 700;
    padding: 0 4px;
    border: 1px solid var(--color-ink);
  }
  .version-state {
    text-transform: uppercase;
    font-weight: 700;
  }
  .version-meta {
    color: var(--color-ink-muted);
  }

  .dossier-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .dossier-accept-btn {
    background: var(--color-yellow);
    color: var(--color-ink);
  }
  .dossier-exclude-btn {
    background: var(--color-surface);
    color: var(--color-ink);
  }
  .dossier-accept-btn:disabled,
  .dossier-exclude-btn:disabled,
  .dossier-recheck-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── As-of time travel (W2.5) ──────────────────────────────────────────── */
  .as-of-control {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: var(--space-3) 0 0;
    padding: var(--space-3);
    border: var(--brut-border-width) solid var(--color-ink);
    border-radius: 0;
    box-shadow: var(--brut-shadow-sm);
  }
  .as-of-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .as-of-kicker {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
  }
  .as-of-field {
    display: inline-flex;
  }
  .as-of-input {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    padding: var(--space-1) var(--space-2);
    border: var(--brut-border-width) solid var(--color-ink);
    border-radius: 0;
    background: var(--color-bg);
    color: var(--color-ink);
  }
  .as-of-anchors {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .as-of-anchors-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    letter-spacing: var(--text-mono-tracking);
  }
  .as-of-anchor {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    padding: var(--space-1) var(--space-2);
    border: var(--brut-border-micro) solid var(--color-ink);
    border-radius: 0;
    background: var(--color-bg);
    color: var(--color-ink);
    cursor: pointer;
    transition: var(--brut-transition);
  }
  .as-of-anchor:hover {
    background: var(--color-ink);
    color: var(--color-bg);
  }
  .as-of-anchor-active {
    background: var(--color-ink);
    color: var(--color-bg);
  }

  .as-of-banner {
    margin: var(--space-3) 0 0;
    padding: var(--space-3);
    border: var(--brut-border-width) solid var(--color-ink);
    border-radius: 0;
    background: var(--color-yellow);
    color: var(--color-ink);
    box-shadow: var(--brut-shadow);
  }
  .as-of-banner-degraded {
    background: var(--brut-coral);
  }
  .as-of-banner-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .as-of-banner-title {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
  }
  .as-of-banner-text {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .as-of-banner-stats {
    display: block;
    margin-top: var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
  }
  .as-of-banner-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .as-of-audit-toggle {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    padding: var(--space-1) var(--space-2);
    border: var(--brut-border-width) solid var(--color-ink);
    border-radius: 0;
    background: var(--color-bg);
    color: var(--color-ink);
    cursor: pointer;
  }
  .as-of-audit-toggle[aria-pressed="true"] {
    background: var(--color-ink);
    color: var(--color-bg);
  }

  /*
   * As-of is VIEW-ONLY. While a historical view is active, every mutating affordance
   * on the explorer (and the readiness library / wizard child components mounted
   * inside it) is hidden — on DESKTOP too, via a state class on the explorer root
   * rather than the mobile body attribute. The verdict keyboard shortcuts (which CSS
   * cannot hide) early-return on `asOfActive` in handleReviewKeydown.
   */
  .as-of-readonly .review-actions,
  .as-of-readonly .dossier-actions,
  .as-of-readonly .dossier-recheck,
  .as-of-readonly .remove-section,
  .as-of-readonly .cohort-complete-actions,
  .as-of-readonly .revalidate-actions,
  .as-of-readonly :global(.wizard-actions),
  .as-of-readonly :global(.lib-new),
  .as-of-readonly :global(.lib-run-archive) {
    display: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .as-of-anchor {
      transition: none;
    }
  }
</style>
