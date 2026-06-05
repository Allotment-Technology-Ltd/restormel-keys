<script lang="ts">
  import { goto } from "$app/navigation";
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
  import { onMount } from "svelte";

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

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";

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

  let queueScope: QueueScope = "review";
  /** Optional verdict narrow — applies on top of Quarantine or All ideas. */
  let verdictFilter: VerdictFilter | null = null;
  let extraUnits: Unit[] = [];
  let loadingMoreUnits = false;
  let loadMoreError: string | null = null;
  /** Client-side verdict overrides until the next server graph reload. */
  let unitOverrides: Record<string, Pick<Unit, "validationStatus" | "validationNote">> = {};
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
  let selectedId: string | null = null;
  let reviewNote = "";
  let actionError: string | null = null;
  let exitingUnitId: string | null = null;
  let flashingReviewAction: ReviewVerdictAction | null = null;
  let revalidateRouteId = "";
  let remediationRouteId = "";
  $: if (revalidateOptions?.defaultRouteId && !revalidateRouteId) {
    revalidateRouteId = revalidateOptions.defaultRouteId;
  }
  $: if (revalidateOptions?.defaultRemediationRouteId && !remediationRouteId) {
    remediationRouteId = revalidateOptions.defaultRemediationRouteId;
  }
  let autoRemediating = false;
  let revalidateError: string | null = null;
  let linkSourcesOptions: {
    enabled: boolean;
    unitsNeedingLink: number;
    candidateSources: number;
    totalUnits: number;
  } | null = null;
  let linkSourcesOptionsLoading = false;
  let linkSourcesScope: "unlinked_only" | "all" = "unlinked_only";
  let linkingSources = false;
  let linkSourcesError: string | null = null;
  let embedOptions: {
    enabled: boolean;
    unembeddedCount: number;
    totalUnits: number;
    embeddedCount: number;
    embedReady: boolean;
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
  let embedBackfillToolEl: HTMLDivElement | undefined;
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
  let workspaceMode: WorkspaceMode = "triage";
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

  onMount(async () => {
    const pageUrl = get(page).url;
    if (pageUrl.searchParams.get("workspace") === "tools") {
      workspaceMode = "tools";
    }
    if (!graph.reviewEnabled || !graph.stats?.units) return;
    revalidateOptionsLoading = !revalidateOptions?.enabled;
    linkSourcesOptionsLoading = true;
    embedOptionsLoading = true;
    try {
      const [revalidateRes, linkRes, embedRes] = await Promise.all([
        revalidateOptions?.enabled
          ? null
          : fetch(`${CONNECT_PIPELINE_API}/graph/revalidate/options`, { credentials: "include" }),
        fetch(`${CONNECT_PIPELINE_API}/graph/link-sources/options`, { credentials: "include" }),
        fetch(`${CONNECT_PIPELINE_API}/graph/embed/options`, { credentials: "include" }),
      ]);
      if (revalidateRes) {
        const data = await revalidateRes.json().catch(() => ({}));
        if (revalidateRes.ok && data.revalidate) {
          revalidateOptions = data.revalidate;
          if (data.revalidate.defaultRouteId && !revalidateRouteId) {
            revalidateRouteId = data.revalidate.defaultRouteId;
          }
          if (data.revalidate.defaultRemediationRouteId && !remediationRouteId) {
            remediationRouteId = data.revalidate.defaultRemediationRouteId;
          }
        }
      }
      if (linkRes) {
        const linkData = await linkRes.json().catch(() => ({}));
        if (linkRes.ok && linkData.linkSources) {
          linkSourcesOptions = linkData.linkSources;
        }
      }
      if (embedRes) {
        const embedData = await embedRes.json().catch(() => ({}));
        if (embedRes.ok && embedData.embedBackfill) {
          embedOptions = embedData.embedBackfill;
          if (embedData.embedBackfill.defaultRouteId && !embedRouteId) {
            embedRouteId = embedData.embedBackfill.defaultRouteId;
          }
        }
      }
    } catch {
      // Tool panels stay hidden when options cannot load.
    } finally {
      revalidateOptionsLoading = false;
      linkSourcesOptionsLoading = false;
      embedOptionsLoading = false;
      if (pageUrl.searchParams.get("focus") === "embed") {
        requestAnimationFrame(() => {
          embedBackfillToolEl?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }
  });

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
  $: unitsPagination = graph.unitsPagination ?? null;
  $: hasMoreUnits =
    unitsPagination?.hasMore ??
    (stats != null && units.length < stats.units);
  $: unitsLoadedLabel =
    stats && stats.units > 0
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
  }

  async function loadMoreUnits() {
    if (loadingMoreUnits || !hasMoreUnits) return;
    loadingMoreUnits = true;
    loadMoreError = null;
    try {
      const params = new URLSearchParams({
        offset: String(units.length),
        limit: String(unitsPagination?.limit ?? 150),
      });
      if (graph.domainPackId) params.set("domain_pack_id", graph.domainPackId);
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/units?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        loadMoreError = data.message ?? `Could not load more ideas (HTTP ${res.status}).`;
        return;
      }
      const incoming = Array.isArray(data.units) ? (data.units as Unit[]) : [];
      const seen = new Set(units.map((u) => u.id));
      extraUnits = [...extraUnits, ...incoming.filter((u) => !seen.has(u.id))];
      if (data.units_load_error) {
        loadMoreError = data.units_load_error;
      }
    } catch {
      loadMoreError = "Network error while loading more ideas.";
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
    embedOptions?.unembeddedCount ?? Math.max(0, (stats?.units ?? 0) - (stats?.embedded ?? 0));

  $: quarantineCount =
    stats?.validation.awaiting_triage ?? revalidateOptions?.quarantineCount ?? loadedNeedsReviewCount;
  $: needsReviewCount = quarantineCount;
  $: uncheckedCount = stats ? stats.validation.unvalidated : 0;
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
    selectedId = null;
    queuePage = 0;
  }

  function toggleVerdictFilter(verdict: VerdictFilter) {
    if (verdictNarrowDisabled(verdict, queueScope)) return;
    verdictFilter = verdictFilter === verdict ? null : verdict;
    selectedId = null;
    queuePage = 0;
  }

  function applyVerdictFilter(verdict: VerdictFilter) {
    workspaceMode = "triage";
    if (verdictNarrowDisabled(verdict, queueScope)) {
      queueScope = "all";
    }
    verdictFilter = verdict;
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

  $: filteredUnits = verdictFilter
    ? scopedUnits.filter((u) => normalizeValidationStatus(u.validationStatus) === verdictFilter)
    : scopedUnits;

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

  function handleReviewKeydown(event: KeyboardEvent) {
    if (!reviewEnabled || !selectedUnit || isReviewShortcutTarget(event.target)) return;

    const key = event.key;
    if (key === "a" || key === "A") {
      event.preventDefault();
      void performReview(selectedUnit, "ok");
      return;
    }
    if (key === "w" || key === "W") {
      event.preventDefault();
      void performReview(selectedUnit, "weak");
      return;
    }
    if (key === "u" || key === "U") {
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

  function performReview(unit: Unit, status: ReviewVerdictAction) {
    if (!reviewEnabled || exitingUnitId) return;
    const nextId = nextQueueUnitId(unit.id);
    flashReviewButton(status);
    exitingUnitId = unit.id;
    window.setTimeout(() => {
      submitReview(unit, status);
      exitingUnitId = null;
      if (nextId) selectedId = nextId;
    }, 150);
  }

  function submitReview(unit: Unit, status: "ok" | "weak" | "unsupported") {
    if (!reviewEnabled) return;
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
        }
      })
      .catch(() => {
        revertReviewOptimistic(unit, snapshot);
        actionError = "Network error while saving your review.";
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
    }, 150);
  }

  async function startSourceLinking() {
    if (!linkSourcesOptions?.enabled || linkingSources) return;
    linkSourcesError = null;
    linkingSources = true;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/link-sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: linkSourcesScope,
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
              : `Could not start source linking (HTTP ${res.status}).`;
        linkSourcesError = msg;
        return;
      }
      const jobId = body.job?.id;
      if (!jobId) {
        linkSourcesError = "Source linking started but no job id was returned.";
        return;
      }
      await goto(`${CONNECT_BASE}/ingest/${jobId}?from=graph&task=link-sources`);
    } catch {
      linkSourcesError = "Network error while starting source linking.";
    } finally {
      linkingSources = false;
    }
  }

  async function startEmbedBackfill() {
    if (!embedOptions?.enabled || embeddingBackfill) return;
    embedError = null;
    embeddingBackfill = true;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(embedRouteId ? { embedding_route_id: embedRouteId } : {}),
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
              : `Could not start embed backfill (HTTP ${res.status}).`;
        embedError = msg;
        return;
      }
      const jobId = body.job?.id;
      if (!jobId) {
        embedError = "Embed backfill started but no job id was returned.";
        return;
      }
      await goto(`${CONNECT_BASE}/ingest/${jobId}?from=graph&task=embed-backfill`);
    } catch {
      embedError = "Network error while starting embed backfill.";
    } finally {
      embeddingBackfill = false;
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
          mode: "validate_and_remediate",
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
      await goto(`${CONNECT_BASE}/ingest/${jobId}?from=graph&task=auto-remediate`);
    } catch {
      revalidateError = "Network error while starting auto-remediation.";
    } finally {
      autoRemediating = false;
    }
  }
</script>

<svelte:window on:keydown={handleReviewKeydown} />

<div class="connect-graph-explorer">
  <BrutalPageHeader
    kicker="Connect · Quality review"
    title="Knowledge graph"
    description="Inspect ideas extracted from your sources, confirm AI validation, and keep agent context trustworthy. {storeLabel}{graph.domainPackTitle ? ` · pack: ${graph.domainPackTitle}` : ''}."
  />

  {#if !stats || stats.units === 0}
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
        <BrutalButton variant="canvas" href={CONNECT_BASE}>Connect home</BrutalButton>
      </div>
    </BrutalCard>
  {:else}
    <BrutalBentoGrid columns={4}>
      <BrutalBentoCell fill="white" label="Ideas">
        <p class="bento-stat">{stats.units.toLocaleString()}</p>
      </BrutalBentoCell>
      <BrutalBentoCell
        fill={workspaceMode === "triage" ? "blue" : "white"}
        label="Connections"
      >
        <div class="bento-stat-stack">
          <p class="bento-stat">{stats.relations.toLocaleString()}</p>
          {#if workspaceMode === "triage"}
            <span class="bento-stat-hint">↓ Review below</span>
          {/if}
        </div>
      </BrutalBentoCell>
      <BrutalBentoCell fill="canvas" label="Groups">
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
      </BrutalBentoCell>
      <BrutalBentoCell fill="neon" label="Embedded">
        {#if unembeddedCount > 0}
          <button
            type="button"
            class="bento-stat-btn brut-focus"
            aria-label="{stats.embedded.toLocaleString()} embedded — {unembeddedCount.toLocaleString()} missing — open embed tool"
            on:click={() => {
              workspaceMode = "tools";
              requestAnimationFrame(() => {
                embedBackfillToolEl?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
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
          {#if stats && stats.units > 0}
            <p class="units-load-meta" role="status">{unitsLoadedLabel}</p>
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
              {#if unitsLoadError}
                Fix the error above, then refresh. Stats may still reflect your full graph even when the review list cannot load.
              {:else if queueScope === "review" && !verdictFilter && needsReviewCount > 0 && units.length < (stats?.units ?? 0)}
                Your graph has {needsReviewCount.toLocaleString()} flagged idea{needsReviewCount === 1 ? "" : "s"}, but
                none appear in the {units.length.toLocaleString()} ideas loaded here. Refresh the page; if this persists,
                check Surreal connectivity in Pipeline → Graph store.
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
                      <span class="unit-status-badge">{statusLabel(unit.validationStatus)}</span>
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
              <BrutalBadge variant={badgeVariant(selectedUnit.validationStatus)} label={statusLabel(selectedUnit.validationStatus)} />
            </div>
            <p class="detail-text">{selectedUnit.text}</p>

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

        {#if embedOptionsLoading}
          <p class="revalidate-lede brut-muted" role="status">Loading embed backfill options…</p>
        {:else if embedOptions?.enabled}
          <div class="revalidate-panel" id="embed-backfill-tool" bind:this={embedBackfillToolEl}>
            <BrutalCard fill="blue" title="Embed missing ideas">
              <p class="revalidate-lede brut-muted">
                {embedOptions.unembeddedCount.toLocaleString()} of {embedOptions.totalUnits.toLocaleString()} ideas lack
                embedding vectors — semantic search and agent retrieval skip them until you embed them here.
              </p>
              {#if !embedOptions.embedReady}
                <p class="revalidate-note brut-muted">
                  Publish an embedding ingestion route in AI models &amp; keys before running embed backfill.
                </p>
              {/if}
              {#if embedOptions.previewUnits.length > 0}
                <div class="embed-preview" aria-label="Sample unembedded ideas">
                  <p class="revalidate-label">Sample unembedded ideas</p>
                  <ul class="embed-preview-list">
                    {#each embedOptions.previewUnits as unit (unit.id)}
                      <li class="embed-preview-item">
                        <span class="embed-preview-text">{unit.text}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              <div class="revalidate-form">
                <label class="revalidate-field" for="embed-backfill-route">
                  <span class="revalidate-label">Embedding route</span>
                  <select
                    id="embed-backfill-route"
                    class="revalidate-input brut-focus"
                    bind:value={embedRouteId}
                    disabled={embeddingBackfill || !embedOptions.embedReady}
                  >
                    {#if (embedOptions.routes ?? []).length === 0}
                      <option value="">Workspace default</option>
                    {:else}
                      <option value="">Workspace default routing</option>
                      {#each embedOptions.routes as route (route.id)}
                        <option value={route.id}>
                          {route.name}{route.isDefault ? " (workspace default)" : ""}
                        </option>
                      {/each}
                    {/if}
                  </select>
                </label>
              </div>
              <div class="revalidate-route-links" aria-label="Embedding route management">
                <a class="revalidate-link brut-focus" href={embedModelsManageHref}>Manage ingest routes</a>
                {#if embedRouteEditHref}
                  <a class="revalidate-link brut-focus" href={embedRouteEditHref}>
                    Edit embedding route
                    {#if selectedEmbedRoute?.activeModel}
                      ({selectedEmbedRoute.activeModel.provider}/{selectedEmbedRoute.activeModel.modelId})
                    {/if}
                  </a>
                {/if}
              </div>
              <p class="revalidate-note brut-muted">
                Route pick applies only to this run — saved workspace ingestion routes stay unchanged.
              </p>
              {#if embedError}
                <BrutalErrorBanner title="Embed backfill not started" message={embedError} />
              {/if}
              <div class="revalidate-actions">
                <button
                  type="button"
                  class="brutal-btn brut-pressable brut-focus brut-fill-blue revalidate-btn"
                  disabled={embeddingBackfill || !embedOptions.embedReady}
                  on:click={startEmbedBackfill}
                >
                  {embeddingBackfill
                    ? "Starting…"
                    : `Embed ${embedOptions.unembeddedCount.toLocaleString()} missing idea${embedOptions.unembeddedCount === 1 ? "" : "s"}`}
                </button>
                <p class="revalidate-note brut-muted">
                  Opens the ingest run console — embedded count updates when the job completes.
                </p>
              </div>
            </BrutalCard>
          </div>
        {/if}

        {#if linkSourcesOptionsLoading}
          <p class="revalidate-lede brut-muted" role="status">Loading graph repair tools…</p>
        {:else if linkSourcesOptions?.enabled}
          <div class="revalidate-panel">
            <BrutalCard fill="white" title="Find sources for ideas">
              <p class="revalidate-lede brut-muted">
                Automatically match ideas to the best available source text from your graph spine,
                pipeline documents, and recent ingest runs. Use this when provenance is missing on an
                existing knowledge graph.
              </p>
              <div class="revalidate-form">
                <label class="revalidate-field" for="link-sources-scope">
                  <span class="revalidate-label">Scope</span>
                  <select
                    id="link-sources-scope"
                    class="revalidate-input brut-focus"
                    bind:value={linkSourcesScope}
                    disabled={linkingSources}
                  >
                    <option value="unlinked_only">
                      Missing provenance only ({linkSourcesOptions.unitsNeedingLink.toLocaleString()})
                    </option>
                    <option value="all">All ideas ({linkSourcesOptions.totalUnits.toLocaleString()})</option>
                  </select>
                </label>
              </div>
              <p class="revalidate-note brut-muted">
                {linkSourcesOptions.candidateSources.toLocaleString()} source
                {linkSourcesOptions.candidateSources === 1 ? "" : "s"} in the matching catalog.
              </p>
              {#if linkSourcesError}
                <BrutalErrorBanner title="Source linking not started" message={linkSourcesError} />
              {/if}
              <div class="revalidate-actions">
                <button
                  type="button"
                  class="brutal-btn brut-pressable brut-focus brut-fill-neon revalidate-btn"
                  disabled={linkingSources}
                  on:click={startSourceLinking}
                >
                  {linkingSources ? "Starting…" : "Find sources for ideas"}
                </button>
                <p class="revalidate-note brut-muted">
                  Opens the ingest run console — source titles and links update when the job completes.
                </p>
              </div>
            </BrutalCard>
          </div>
        {:else if graph.reviewEnabled && graph.stats?.units}
          <div class="revalidate-panel">
            <BrutalCard fill="canvas" title="Find sources for ideas">
              <p class="brut-muted">
                Add parsed documents in Pipeline → Sources or complete an ingest run so automated matching
                has source text to search.
              </p>
              <BrutalButton variant="blue" href={pipelineWizardHref("sources")}>Pipeline sources</BrutalButton>
            </BrutalCard>
          </div>
        {/if}

        {#if revalidateOptionsLoading}
          <p class="revalidate-lede brut-muted" role="status">Loading auto-remediation options…</p>
        {:else if revalidateOptions?.enabled}
          {#if quarantineCount > 0 || unsupportedUntriagedCount > 0}
            <div class="revalidate-panel">
              <BrutalCard fill="neon" title="Auto-remediate quarantine">
                <p class="revalidate-lede brut-muted">
                  Re-run validation and remediation on quarantined ideas — repair faithful wording, drop unsupportable
                  claims, and re-embed repairs. Items still flagged afterward stay in quarantine for your review.
                </p>
                {#if linkSourcesOptions?.enabled && linkSourcesOptions.unitsNeedingLink > 0}
                  <p class="revalidate-note brut-muted">
                    {linkSourcesOptions.unitsNeedingLink.toLocaleString()} idea
                    {linkSourcesOptions.unitsNeedingLink === 1 ? "" : "s"} lack linked source text — run
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
                </div>
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
                    Opens the ingest run console — validation statuses update when the job completes.
                  </p>
                </div>
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
    font-size: var(--text-3xl);
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1;
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
    padding: var(--space-2);
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
    background: var(--color-yellow);
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
    background: var(--color-yellow);
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
    background: var(--color-yellow);
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

  .revalidate-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
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
    font-size: var(--text-lg);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
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
    background: var(--color-yellow);
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
    background: var(--color-yellow);
    border-left: 4px solid var(--color-yellow);
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
    background: var(--color-yellow);
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
      transform 150ms ease-out,
      opacity 150ms ease-out,
      box-shadow var(--brut-transition),
      border-color var(--brut-transition);
    overflow: hidden;
  }

  .unit-row:hover {
    box-shadow: var(--brut-shadow-hover);
    transform: translate(2px, 2px);
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
    letter-spacing: 0.04em;
    text-transform: capitalize;
    color: var(--color-ink);
  }

  .unit-row-inner {
    position: relative;
    display: block;
    padding: var(--space-3);
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
</style>
