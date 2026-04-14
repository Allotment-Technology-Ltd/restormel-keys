<script lang="ts">
  import { browser } from "$app/environment";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { beforeNavigate, invalidate, invalidateAll } from "$app/navigation";
  import { onMount, tick } from "svelte";
  import { clampRouteStepLabel, ROUTE_STEP_LABEL_MAX_LENGTH } from "$lib/route-step-label";
  import RouteFlowCanvas from "$lib/components/dashboard/RouteFlowCanvas.svelte";

  /** Public `applyRouteDraft` / `revertRouteDraft` from `<RouteFlowCanvas bind:this={…} />`. */
  let routeFlowCanvasRef:
    | { applyRouteDraft: () => Promise<boolean>; revertRouteDraft: () => void }
    | undefined;
  import RouteGuardRailsPanel from "$lib/components/dashboard/RouteGuardRailsPanel.svelte";
  import { buildRouteFlowSegments, routeFlowSegmentListToStepIds } from "$lib/route-flow-segments";
  import { getPrimaryChainEnableBlockMessage } from "$lib/route-flow-primary-enable-guard";

  export let data: {
    project: { id: string; name: string } | null;
    route: {
      id: string;
      name: string;
      description: string | null;
      status: string;
      defaultModelId: string | null;
      billingMode: string | null;
      routeMode: string | null;
      environmentId: string;
      workload?: string | null;
      stage?: string | null;
      version?: number | null;
      publishedVersion?: number | null;
      entryStepId?: string | null;
      flowLayout?: Record<string, unknown> | null;
      /** Control-plane row `updated_at` (ms since epoch). */
      updatedAt?: number;
    } | null;
    ingestionWorkload: string;
    ingestionStageIds: string[];
    steps: {
      id: string;
      orderIndex: number;
      providerPreference: string | null;
      modelId: string | null;
      fallbackOn: string | null;
      timeoutMs: number | null;
      enabled: boolean;
      label?: string | null;
      switchCriteria?: Record<string, unknown> | null;
      retryPolicy?: Record<string, unknown> | null;
      costPolicy?: Record<string, unknown> | null;
      notes?: string | null;
      modelPool?: Record<string, unknown> | null;
      parallelGroupId?: string | null;
      parallelBranchRole?: string | null;
    }[];
    availablePolicies: { id: string; name: string; type: string; status: string }[];
    routePolicyBindings: { id: string; policyId: string; policyName: string; policyType: string }[];
    routeStepLinks: {
      id: string;
      fromStepId: string;
      toStepId: string;
      priority: number;
      label: string | null;
    }[];
    stepPolicyBindings: {
      stepId: string;
      bindings: { id: string; policyId: string; policyName: string; policyType: string }[];
    }[];
    modelOptions: string[];
    /** Catalog display names for model id (select labels). */
    modelCatalog: { id: string; name: string }[];
    /** Model ids that have an eligible `provider_model_variants` row for each dashboard provider key. */
    modelIdsByProvider: Record<string, string[]>;
    modelLifecycleWarnings: {
      id: string;
      canonicalName: string;
      lifecycleState: string | null;
      deprecationDate: number | null;
      retirementDate: number | null;
      replacementModelId: string | null;
    }[];
    error: string | null;
  };

  /** Re-fetch only this route page (not every parent layout) — keeps step edits responsive. */
  async function refreshRouteDetail() {
    if (!data.route?.id) {
      await invalidateAll();
      return;
    }
    await invalidate(`app:route-detail:${data.route.id}`);
  }

  let inspectorSaving = false;
  /** True while `RouteFlowCanvas` is applying the map (PUT graph / invalidate). */
  let flowToolbarSaving = false;
  let saveError = "";
  let editName = data.route?.name ?? "";
  let editStatus = data.route?.status ?? "active";
  let editBillingMode = data.route?.billingMode ?? "";
  let creatingStep = false;
  let addParallelModelBusy = false;
  let stepError = "";
  let stepProviderPreference = "openai";
  let stepModelId = "";
  let stepFallbackOn = "error";
  let stepTimeoutMs = "12000";
  let editingStepId: string | null = null;
  let editingProviderPreference = "openai";
  let editingModelId = "";
  let editingFallbackOn = "error";
  let editingTimeoutMs = "12000";
  let editingLabel = "";
  let editingSwitchCriteriaText = "";
  let editingRetryPolicyText = "";
  let editingCostPolicyText = "";
  let editingNotesText = "";
  let editingModelPoolText = "";
  let editingParallelGroupId = "";
  let editingParallelBranchRole = "";
  /** Step title in drawer: show Rename link vs inline label input. */
  let stepLabelEditMode = false;
  let stepLabelInputEl: HTMLInputElement | null = null;
  let expandedStepId: string | null = null;
  /** Cleared when the inspected step changes so remove confirmation never targets the wrong step. */
  let lastExpandedStepIdForRemoveUi: string | null = null;
  let stepRemoveAwaitingConfirmId: string | null = null;
  let stepBusyId: string | null = null;
  /** Route map (edges + layout) draft differs from server — updated from `RouteFlowCanvas`. */
  let mapDraftDirty = false;
  /**
   * Full step rows merged from the inspector (Call settings / Advanced **Apply changes**) before **Apply to server**.
   * Keys are step ids; values replace `data.steps` entries for the flow map only until PATCH + refresh.
   */
  let localRouteStepById: Record<string, (typeof data.steps)[number]> = {};
  /** Client clock when **Apply to server** last succeeded (for status strip; merged with `route.updatedAt`). */
  let lastClientFlowApplyAtMs: number | null = null;
  let prevRouteDetailId = "";
  $: {
    const rid = data.route?.id ?? "";
    if (prevRouteDetailId && rid && rid !== prevRouteDetailId) {
      localRouteStepById = {};
      lastClientFlowApplyAtMs = null;
      pendingPolicyOps = [];
    }
    prevRouteDetailId = rid;
  }
  $: displaySteps = data.steps.map((s) => localRouteStepById[s.id] ?? s);
  let selectedPolicyId = "";
  let bindingPolicy = false;
  let policyError = "";
  /** Step-level guard rails (route_step); UI lives in RouteGuardRailsPanel when the flow inspector is open. */
  let stepBindingBusy = false;
  let stepUnbindBusyId: string | null = null;
  let stepPolicyInspectorError = "";
  let creatingAndBindingPolicy = false;
  let createPolicyName = "";
  let createPolicyType = "model_allowlist";
  let unbindingId: string | null = null;
  let editWorkload = "";
  let editStage = "";
  let editDescription = "";
  let lastBoundRouteId = "";
  /** `null` = append; otherwise insert new step after this anchor step id (flow map +). */
  let addStepAnchorId: string | null = null;
  let addStepDialogEl: HTMLDialogElement | undefined;

  /** IA: flow canvas vs route + guard rails setup vs secondary (logs). */
  let workspaceTab: "flow" | "setup" | "more" = "flow";
  /** Map draft lives in `RouteFlowCanvas`; when the Flow tab unmounts, clear stale parent flag so leave guards and clicks stay sane. */
  $: {
    if (workspaceTab !== "flow") {
      mapDraftDirty = false;
    }
  }
  let routeSaving = false;
  /** Step the user asked to open while the current model still has unsaved edits (resolved in-panel, not via silent discard). */
  let pendingInspectorStep: (typeof data.steps)[number] | null = null;

  function stepSummaryLabel(step: (typeof data.steps)[number]): string {
    return step.label?.trim() ? step.label.trim() : `Step ${step.orderIndex + 1}`;
  }

  function formatSavedAtMs(ms: number): string {
    try {
      return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return "";
    }
  }

  function modelIdsForProvider(pref: string | null | undefined): string[] {
    const p = (pref ?? "").trim() || "openai";
    const by = data.modelIdsByProvider;
    if (by && typeof by === "object" && Array.isArray(by[p])) return by[p] as string[];
    return data.modelOptions ?? [];
  }

  function modelCatalogLabel(modelId: string): string {
    const row = data.modelCatalog?.find((m) => m.id === modelId);
    return row?.name ?? modelId;
  }

  /** Add-step dialog: drop model if it does not exist for the chosen provider. */
  $: {
    const ids = modelIdsForProvider(stepProviderPreference);
    if (stepModelId.trim() && !ids.includes(stepModelId.trim())) {
      stepModelId = "";
    }
  }

  /** Inspector: saved model must belong to the selected provider’s catalog (invalid combos reset). */
  $: {
    const ids = modelIdsForProvider(editingProviderPreference);
    const m = editingModelId.trim();
    if (!m) {
      /* keep empty */
    } else if (ids.length === 0) {
      editingModelId = "";
    } else if (!ids.includes(m)) {
      editingModelId = ids[0] ?? "";
    }
  }

  $: if (data.route) {
    editName = data.route.name;
    editStatus = data.route.status;
    editBillingMode = data.route.billingMode ?? "";
    editDescription = data.route.description ?? "";
  }
  $: if (data.route && data.route.id !== lastBoundRouteId) {
    lastBoundRouteId = data.route.id;
    editWorkload = data.route.workload ?? "";
    editStage = data.route.stage ?? "";
  }
  $: if (expandedStepId && !data.steps.some((s) => s.id === expandedStepId)) {
    expandedStepId = null;
    editingStepId = null;
  }
  function stringifyJsonField(value: Record<string, unknown> | null | undefined): string {
    if (value == null) return "";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }

  function parseOptionalJsonObject(
    raw: string,
    fieldLabel: string
  ): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
    const t = raw.trim();
    if (!t) return { ok: true, value: null };
    try {
      const parsed: unknown = JSON.parse(t);
      if (parsed === null) return { ok: true, value: null };
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: `${fieldLabel} must be a JSON object or empty` };
      }
      return { ok: true, value: parsed as Record<string, unknown> };
    } catch {
      return { ok: false, error: `${fieldLabel} is not valid JSON` };
    }
  }

  /** Semantic compare for optional JSON object fields on steps. */
  function jsonFieldMatchesServer(
    raw: string,
    server: Record<string, unknown> | null | undefined
  ): boolean {
    const t = raw.trim();
    if (!t) {
      return (
        server == null ||
        (typeof server === "object" &&
          !Array.isArray(server) &&
          Object.keys(server as object).length === 0)
      );
    }
    try {
      const parsed: unknown = JSON.parse(t);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
      return JSON.stringify(parsed) === JSON.stringify(server ?? null);
    } catch {
      return false;
    }
  }

  /**
   * Compare server step row to inspector draft. Pass every draft field as an argument so the
   * `$: stepDirty = …` reactive statement reads them at the top level — Svelte does not always
   * track dependencies that are only read inside a callee invoked from `$:`.
   */
  function isStepDirtySnapshot(
    step: (typeof data.steps)[number],
    providerPreference: string,
    modelId: string,
    fallbackOn: string,
    timeoutMs: string,
    label: string,
    notesText: string,
    parallelGroupId: string,
    parallelBranchRole: string,
    switchCriteriaText: string,
    retryPolicyText: string,
    costPolicyText: string,
    modelPoolText: string
  ): boolean {
    if ((step.providerPreference ?? "openai") !== providerPreference) return true;
    if ((step.modelId ?? "").trim() !== modelId.trim()) return true;
    if ((step.fallbackOn ?? "error") !== fallbackOn) return true;
    if (String(step.timeoutMs ?? 12000) !== timeoutMs.trim()) return true;
    if ((step.label?.trim() ?? "") !== label.trim()) return true;
    if ((step.notes ?? "").trim() !== notesText.trim()) return true;
    if ((step.parallelGroupId ?? "").trim() !== parallelGroupId.trim()) return true;
    if ((step.parallelBranchRole ?? "").trim() !== parallelBranchRole.trim()) return true;
    if (!jsonFieldMatchesServer(switchCriteriaText, step.switchCriteria ?? null)) return true;
    if (!jsonFieldMatchesServer(retryPolicyText, step.retryPolicy ?? null)) return true;
    if (!jsonFieldMatchesServer(costPolicyText, step.costPolicy ?? null)) return true;
    if (!jsonFieldMatchesServer(modelPoolText, step.modelPool ?? null)) return true;
    return false;
  }

  $: resolvedInspectorBaseline = expandedStepId
    ? localRouteStepById[expandedStepId] ?? data.steps.find((s) => s.id === expandedStepId) ?? null
    : null;
  $: routeDirty =
    data.route != null &&
    (editName.trim() !== data.route.name.trim() ||
      editStatus !== data.route.status ||
      (editBillingMode || "") !== (data.route.billingMode ?? "") ||
      (editWorkload.trim() || "") !== (data.route.workload ?? "") ||
      (editStage.trim() || "") !== (data.route.stage ?? "") ||
      editDescription.trim() !== (data.route.description ?? "").trim());
  $: stepDirty =
    resolvedInspectorBaseline != null
      ? isStepDirtySnapshot(
          resolvedInspectorBaseline,
          editingProviderPreference,
          editingModelId,
          editingFallbackOn,
          editingTimeoutMs,
          editingLabel,
          editingNotesText,
          editingParallelGroupId,
          editingParallelBranchRole,
          editingSwitchCriteriaText,
          editingRetryPolicyText,
          editingCostPolicyText,
          editingModelPoolText
        )
      : false;
  /** Call settings + step label (label is merged here so a label-only edit still has an apply path). */
  $: callSettingsSectionDirty =
    resolvedInspectorBaseline != null &&
    ((resolvedInspectorBaseline.providerPreference ?? "openai") !== editingProviderPreference ||
      (resolvedInspectorBaseline.modelId ?? "").trim() !== editingModelId.trim() ||
      (resolvedInspectorBaseline.fallbackOn ?? "error") !== editingFallbackOn ||
      String(resolvedInspectorBaseline.timeoutMs ?? 12000) !== editingTimeoutMs.trim() ||
      (resolvedInspectorBaseline.label?.trim() ?? "") !== editingLabel.trim());
  $: advancedSectionDirty =
    resolvedInspectorBaseline != null &&
    ((resolvedInspectorBaseline.notes ?? "").trim() !== editingNotesText.trim() ||
      (resolvedInspectorBaseline.parallelGroupId ?? "").trim() !== editingParallelGroupId.trim() ||
      (resolvedInspectorBaseline.parallelBranchRole ?? "").trim() !== editingParallelBranchRole.trim() ||
      !jsonFieldMatchesServer(editingSwitchCriteriaText, resolvedInspectorBaseline.switchCriteria ?? null) ||
      !jsonFieldMatchesServer(editingRetryPolicyText, resolvedInspectorBaseline.retryPolicy ?? null) ||
      !jsonFieldMatchesServer(editingCostPolicyText, resolvedInspectorBaseline.costPolicy ?? null) ||
      !jsonFieldMatchesServer(editingModelPoolText, resolvedInspectorBaseline.modelPool ?? null));
  function committedRowDiffersFromServer(
    server: (typeof data.steps)[number],
    merged: (typeof data.steps)[number]
  ): boolean {
    if (server.orderIndex !== merged.orderIndex) return true;
    if (server.enabled !== merged.enabled) return true;
    return isStepDirtySnapshot(
      server,
      merged.providerPreference ?? "openai",
      (merged.modelId ?? "").trim(),
      merged.fallbackOn ?? "error",
      String(merged.timeoutMs ?? 12000),
      (merged.label?.trim() ?? ""),
      (merged.notes ?? "").trim(),
      (merged.parallelGroupId ?? "").trim(),
      (merged.parallelBranchRole ?? "").trim(),
      stringifyJsonField(merged.switchCriteria ?? undefined),
      stringifyJsonField(merged.retryPolicy ?? undefined),
      stringifyJsonField(merged.costPolicy ?? undefined),
      stringifyJsonField(merged.modelPool ?? undefined)
    );
  }

  function stepCommittedDiffersFromServer(stepId: string): boolean {
    const ov = localRouteStepById[stepId];
    const sv = data.steps.find((s) => s.id === stepId);
    if (!ov) return false;
    if (!sv) return true;
    return committedRowDiffersFromServer(sv, ov);
  }
  $: inspectorPendingServerPatch = Object.keys(localRouteStepById).some((id) => stepCommittedDiffersFromServer(id));

  /** Guard-rail bind/unbind queued until **Apply to server** (same batch as step/map drafts). */
  type PendingPolicyOp =
    | { kind: "bind_route"; policyId: string }
    | { kind: "bind_step"; policyId: string; stepId: string }
    | { kind: "unbind"; policyId: string; bindingId: string };
  let pendingPolicyOps: PendingPolicyOp[] = [];
  $: policyDraftPending = pendingPolicyOps.length > 0;

  function applyPendingRoutePolicyRows(
    base: { id: string; policyId: string; policyName: string; policyType: string }[],
    ops: PendingPolicyOp[],
    policies: { id: string; name: string; type: string }[]
  ): { id: string; policyId: string; policyName: string; policyType: string }[] {
    let rows = [...base];
    for (const op of ops) {
      if (op.kind === "bind_route") {
        const p = policies.find((x) => x.id === op.policyId);
        rows.push({
          id: `pending-bind:route:${op.policyId}`,
          policyId: op.policyId,
          policyName: p?.name ?? "Policy",
          policyType: p?.type ?? "unknown",
        });
      } else if (op.kind === "unbind") {
        rows = rows.filter((b) => b.id !== op.bindingId);
      }
    }
    return rows;
  }

  function applyPendingStepPolicyRows(
    base: { stepId: string; bindings: { id: string; policyId: string; policyName: string; policyType: string }[] }[],
    ops: PendingPolicyOp[],
    policies: { id: string; name: string; type: string }[]
  ): { stepId: string; bindings: { id: string; policyId: string; policyName: string; policyType: string }[] }[] {
    const byStep = new Map(
      base.map((sb) => [sb.stepId, { stepId: sb.stepId, bindings: [...sb.bindings] } as (typeof base)[number]])
    );
    for (const op of ops) {
      if (op.kind === "bind_step") {
        const row = byStep.get(op.stepId) ?? { stepId: op.stepId, bindings: [] };
        const p = policies.find((x) => x.id === op.policyId);
        row.bindings.push({
          id: `pending-bind:step:${op.stepId}:${op.policyId}`,
          policyId: op.policyId,
          policyName: p?.name ?? "Policy",
          policyType: p?.type ?? "unknown",
        });
        byStep.set(op.stepId, row);
      } else if (op.kind === "unbind") {
        for (const sb of byStep.values()) {
          sb.bindings = sb.bindings.filter((b) => b.id !== op.bindingId);
        }
      }
    }
    return base.map((sb) => byStep.get(sb.stepId) ?? sb);
  }

  $: effectiveRoutePolicyBindings = applyPendingRoutePolicyRows(
    data.routePolicyBindings,
    pendingPolicyOps,
    data.availablePolicies
  );
  $: effectiveStepPolicyBindings = applyPendingStepPolicyRows(
    data.stepPolicyBindings,
    pendingPolicyOps,
    data.availablePolicies
  );

  /** Step/map **Apply to server** also flushes queued policy binds/unbinds (`RouteFlowCanvas` prop). */
  $: flowInspectorApplyDirty = inspectorPendingServerPatch || policyDraftPending;

  /** Flow tab: unsubmitted inspector typing, map graph draft, or locally merged step rows not yet PATCHed. */
  $: flowDraftPendingServer =
    stepDirty || mapDraftDirty || inspectorPendingServerPatch || policyDraftPending;
  $: flowLastSavedAtMs =
    !flowDraftPendingServer && data.route
      ? Math.max(
          lastClientFlowApplyAtMs ?? 0,
          typeof data.route.updatedAt === "number" ? data.route.updatedAt : 0
        )
      : 0;
  $: flowLastSavedLabel = flowLastSavedAtMs > 0 ? formatSavedAtMs(flowLastSavedAtMs) : "";
  $: if (!expandedStepId) pendingInspectorStep = null;
  $: inspectorHeadStep = expandedStepId ? displaySteps.find((s) => s.id === expandedStepId) ?? null : null;
  $: inspectorHeadTitle = inspectorHeadStep
    ? editingLabel.trim() || `Step ${inspectorHeadStep.orderIndex + 1}`
    : "Model inspector";

  $: if (expandedStepId !== lastExpandedStepIdForRemoveUi) {
    stepRemoveAwaitingConfirmId = null;
    lastExpandedStepIdForRemoveUi = expandedStepId;
  }

  /** Used by beforeunload / beforeNavigate — mutate `.dirty` only via reactive assignment below. */
  const unloadState = { dirty: false };
  $: unloadState.dirty =
    routeDirty || stepDirty || mapDraftDirty || inspectorPendingServerPatch || policyDraftPending;

  function resetRouteSetupFormFromServer() {
    if (!data.route) return;
    editName = data.route.name;
    editStatus = data.route.status;
    editBillingMode = data.route.billingMode ?? "";
    editDescription = data.route.description ?? "";
    editWorkload = data.route.workload ?? "";
    editStage = data.route.stage ?? "";
  }

  beforeNavigate((navigation) => {
    if (!browser) return;
    if (!unloadState.dirty) return;
    const leave = window.confirm(
      "You have changes that are not saved to the server yet (flow map and/or model inspector, or route configuration). Leave and discard them?"
    );
    if (!leave) {
      navigation.cancel();
      return;
    }
    /**
     * User confirmed leaving: drop local flow + inspector drafts and reinstate last-loaded server rows on the map
     * and in the inspector. When the flow canvas is not mounted (e.g. Configuration tab), clear parent draft flags
     * and overlays so returning to Flow map does not resurrect stale drafts.
     */
    pendingInspectorStep = null;
    mapDraftDirty = false;
    localRouteStepById = {};
    pendingPolicyOps = [];
    if (routeFlowCanvasRef && typeof routeFlowCanvasRef.revertRouteDraft === "function") {
      routeFlowCanvasRef.revertRouteDraft();
    } else {
      revertInspectorFromToolbar();
    }
    resetRouteSetupFormFromServer();
  });

  onMount(() => {
    if (!browser) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (unloadState.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  });

  $: orderedSteps = [...displaySteps].sort((a, b) => a.orderIndex - b.orderIndex);

  /** Sync next-step edges + entry to a linear chain (matches vertical route map default). */
  /** PATCH `orderIndex` 0..n-1 for each step id (used after insert-in-middle). */
  async function patchStepOrderIndices(orderedIds: string[]): Promise<boolean> {
    if (!data.project || !data.route) return false;
    const endpoint = `${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps`;
    const n = orderedIds.length;
    const maxCurrent = orderedIds.reduce((acc, id) => {
      const s = data.steps.find((x) => x.id === id);
      return Math.max(acc, s?.orderIndex ?? -1);
    }, -1);
    /** Avoid duplicate_order_index on PATCH: never assign i while another step still holds i. */
    const bumpBase = maxCurrent + n + 1;
    for (let i = 0; i < n; i++) {
      const res = await fetch(`${endpoint}/${orderedIds[i]}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIndex: bumpBase + i }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        stepError =
          (body as { detail?: string }).detail ??
          (body as { error?: string }).error ??
          `Reorder failed (${res.status})`;
        return false;
      }
    }
    for (let i = 0; i < n; i++) {
      const res = await fetch(`${endpoint}/${orderedIds[i]}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIndex: i }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        stepError =
          (body as { detail?: string }).detail ??
          (body as { error?: string }).error ??
          `Reorder failed (${res.status})`;
        return false;
      }
    }
    return true;
  }

  async function persistLinearRouteGraph(stepIdsOrdered: string[]): Promise<boolean> {
    if (!data.project || !data.route) return false;
    const edges: { fromStepId: string; toStepId: string; priority: number }[] = [];
    for (let i = 0; i < stepIdsOrdered.length - 1; i++) {
      edges.push({ fromStepId: stepIdsOrdered[i], toStepId: stepIdsOrdered[i + 1], priority: 0 });
    }
    const res = await fetch(
      `${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/graph`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edges,
          entryStepId: stepIdsOrdered[0] ?? null,
        }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      stepError =
        (body as { detail?: string }).detail ??
        (body as { error?: string }).error ??
        `Route graph sync failed (${res.status})`;
      return false;
    }
    return true;
  }

  function newParallelGroupId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `pg-${crypto.randomUUID()}`;
    }
    return `pg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /** Move `newStepId` to sit immediately after `insertAfterStepId` in order + linear graph edges. */
  async function reorderNewParallelStep(insertAfterStepId: string, newStepId: string): Promise<boolean> {
    if (!data.project || !data.route) return false;
    await refreshRouteDetail();
    const ordered = [...data.steps].sort((a, b) => a.orderIndex - b.orderIndex);
    const ids = ordered.map((s) => s.id);
    if (!ids.includes(newStepId) || !ids.includes(insertAfterStepId)) {
      stepError = "Could not place the new step in the chain. Try refreshing the page.";
      return false;
    }
    const without = ids.filter((id) => id !== newStepId);
    const ins = without.indexOf(insertAfterStepId);
    if (ins < 0) {
      stepError = "Could not place the new step — anchor missing.";
      return false;
    }
    const nextIds = [...without.slice(0, ins + 1), newStepId, ...without.slice(ins + 1)];
    const okOrder = await patchStepOrderIndices(nextIds);
    if (!okOrder) return false;
    const okGraph = await persistLinearRouteGraph(nextIds);
    if (!okGraph) return false;
    await refreshRouteDetail();
    return true;
  }

  /** Index among flow segments (linear steps + whole parallel groups) for move up/down. */
  $: reorderSegmentsForMove = buildRouteFlowSegments(orderedSteps);
  $: selectedSegmentIndex =
    expandedStepId !== null
      ? reorderSegmentsForMove.findIndex((seg) => seg.steps.some((s) => s.id === expandedStepId))
      : -1;
  $: flowSegmentCount = reorderSegmentsForMove.length;
  /** Swap whole segment with the one above (not available for the first / primary segment, or when there is only one segment). */
  $: canReorderSegmentUp =
    expandedStepId !== null && selectedSegmentIndex > 0 && flowSegmentCount > 1;
  /** Swap whole segment with the one below (not available for the last segment, or when there is only one segment). */
  $: canReorderSegmentDown =
    expandedStepId !== null &&
    selectedSegmentIndex >= 0 &&
    selectedSegmentIndex < flowSegmentCount - 1 &&
    flowSegmentCount > 1;
  $: bindingsForInspectorStep =
    expandedStepId != null
      ? effectiveStepPolicyBindings.find((x) => x.stepId === expandedStepId)?.bindings ?? []
      : [];
  /** Whole-route attach: hide policies already on the route or any model in this route. */
  $: policyIdsUnavailableForRouteGuardAttach = [
    ...new Set([
      ...effectiveRoutePolicyBindings.map((b) => b.policyId),
      ...effectiveStepPolicyBindings.flatMap((sb) => sb.bindings.map((x) => x.policyId)),
    ]),
  ];
  /** Model-only attach: hide policies on the whole route or already on this model (duplicates). */
  $: policyIdsUnavailableForStepGuardAttach =
    expandedStepId != null
      ? [
          ...new Set([
            ...effectiveRoutePolicyBindings.map((b) => b.policyId),
            ...(effectiveStepPolicyBindings.find((sb) => sb.stepId === expandedStepId)?.bindings ?? []).map(
              (x) => x.policyId
            ),
          ]),
        ]
      : [];

  /**
   * Step-only bindings on other models (not the open inspector step). Same ids feed
   * `policyIdsUnavailableForRouteGuardAttach`, so the picker can look “empty” while Entire route / This step
   * lists are still “None yet.” — surface these so the conflict rule is visible.
   */
  $: otherModelsStepGuardRails =
    expandedStepId != null
      ? effectiveStepPolicyBindings
          .filter((sb) => sb.stepId !== expandedStepId && sb.bindings.length > 0)
          .map((sb) => {
            const st = data.steps.find((s) => s.id === sb.stepId);
            const stepLabel = st
              ? (st.label?.trim() ? st.label.trim() : `Step ${st.orderIndex + 1}`)
              : "Another model";
            return { stepId: sb.stepId, stepLabel, bindings: sb.bindings };
          })
      : [];

  async function persistRoute(): Promise<boolean> {
    if (!data.project || !data.route) return false;
    saveError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          status: editStatus,
          billingMode: editBillingMode || null,
          routeMode: data.route.routeMode ?? null,
          workload: editWorkload.trim() || null,
          stage: editStage.trim() || null,
          description: editDescription.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        await refreshRouteDetail();
        return true;
      }
      saveError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      return false;
    } catch (e) {
      saveError = e instanceof Error ? e.message : "Request failed";
      return false;
    }
  }

  async function finalizeLocalOverlay(merged: (typeof data.steps)[number]): Promise<boolean> {
    const server = data.steps.find((s) => s.id === merged.id);
    if (!server) return false;
    stepError = "";
    if (!committedRowDiffersFromServer(server, merged)) {
      const next = { ...localRouteStepById };
      delete next[merged.id];
      localRouteStepById = next;
    } else {
      localRouteStepById = { ...localRouteStepById, [merged.id]: merged };
    }
    startEditStep(merged);
    pendingInspectorStep = null;
    await tick();
    return true;
  }

  /** Merge every inspector field; used when switching cards with a full dirty inspector. */
  function mergeAllFieldsFromEditing(): (typeof data.steps)[number] | null {
    if (!expandedStepId) return null;
    const server = data.steps.find((s) => s.id === expandedStepId);
    if (!server) return null;
    const base = localRouteStepById[expandedStepId] ?? server;
    const sw = parseOptionalJsonObject(editingSwitchCriteriaText, "Switch criteria");
    if (!sw.ok) {
      stepError = sw.error;
      return null;
    }
    const rp = parseOptionalJsonObject(editingRetryPolicyText, "Retry policy");
    if (!rp.ok) {
      stepError = rp.error;
      return null;
    }
    const cp = parseOptionalJsonObject(editingCostPolicyText, "Cost policy");
    if (!cp.ok) {
      stepError = cp.error;
      return null;
    }
    const mp = parseOptionalJsonObject(editingModelPoolText, "Model pool");
    if (!mp.ok) {
      stepError = mp.error;
      return null;
    }
    const timeoutNum = parseInt(editingTimeoutMs, 10);
    return {
      ...base,
      providerPreference: editingProviderPreference || null,
      modelId: editingModelId.trim() || null,
      fallbackOn: editingFallbackOn || "error",
      timeoutMs: Number.isFinite(timeoutNum) ? timeoutNum : 12000,
      label: clampRouteStepLabel(editingLabel) || null,
      switchCriteria: sw.value,
      retryPolicy: rp.value,
      costPolicy: cp.value,
      notes: editingNotesText.trim() || null,
      modelPool: mp.value,
      parallelGroupId: editingParallelGroupId.trim() || null,
      parallelBranchRole: editingParallelBranchRole.trim() || null,
    };
  }

  async function commitCallSettingsToLocalRouteMap(): Promise<boolean> {
    syncStepLabelFromInput();
    await tick();
    if (!expandedStepId || !resolvedInspectorBaseline) return false;
    const base = resolvedInspectorBaseline;
    const timeoutNum = parseInt(editingTimeoutMs, 10);
    const merged: (typeof data.steps)[number] = {
      ...base,
      providerPreference: editingProviderPreference || null,
      modelId: editingModelId.trim() || null,
      fallbackOn: editingFallbackOn || "error",
      timeoutMs: Number.isFinite(timeoutNum) ? timeoutNum : 12000,
      label: clampRouteStepLabel(editingLabel) || null,
    };
    return finalizeLocalOverlay(merged);
  }

  async function commitAdvancedToLocalRouteMap(): Promise<boolean> {
    if (!expandedStepId || !resolvedInspectorBaseline) return false;
    const base = resolvedInspectorBaseline;
    const sw = parseOptionalJsonObject(editingSwitchCriteriaText, "Switch criteria");
    if (!sw.ok) {
      stepError = sw.error;
      return false;
    }
    const rp = parseOptionalJsonObject(editingRetryPolicyText, "Retry policy");
    if (!rp.ok) {
      stepError = rp.error;
      return false;
    }
    const cp = parseOptionalJsonObject(editingCostPolicyText, "Cost policy");
    if (!cp.ok) {
      stepError = cp.error;
      return false;
    }
    const mp = parseOptionalJsonObject(editingModelPoolText, "Model pool");
    if (!mp.ok) {
      stepError = mp.error;
      return false;
    }
    const merged: (typeof data.steps)[number] = {
      ...base,
      switchCriteria: sw.value,
      retryPolicy: rp.value,
      costPolicy: cp.value,
      notes: editingNotesText.trim() || null,
      modelPool: mp.value,
      parallelGroupId: editingParallelGroupId.trim() || null,
      parallelBranchRole: editingParallelBranchRole.trim() || null,
    };
    return finalizeLocalOverlay(merged);
  }

  async function commitAllEditingToLocalRouteMap(): Promise<boolean> {
    syncStepLabelFromInput();
    await tick();
    if (!expandedStepId) return false;
    const merged = mergeAllFieldsFromEditing();
    if (!merged) return false;
    return finalizeLocalOverlay(merged);
  }

  async function persistStepFromRow(stepId: string, row: (typeof data.steps)[number]): Promise<boolean> {
    if (!data.project || !data.route) return false;
    stepError = "";
    stepBusyId = stepId;
    try {
      const res = await fetch(
        `${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps/${stepId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerPreference: row.providerPreference || null,
            modelId: (row.modelId ?? "").trim() || null,
            fallbackOn: row.fallbackOn || "error",
            timeoutMs: row.timeoutMs ?? 12000,
            enabled: row.enabled,
            label: clampRouteStepLabel(row.label ?? "") || null,
            switchCriteria: row.switchCriteria ?? null,
            retryPolicy: row.retryPolicy ?? null,
            costPolicy: row.costPolicy ?? null,
            notes: (row.notes ?? "").trim() || null,
            modelPool: row.modelPool ?? null,
            parallelGroupId: (row.parallelGroupId ?? "").trim() || null,
            parallelBranchRole: (row.parallelBranchRole ?? "").trim() || null,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        stepError =
          (body as { detail?: string; error?: string }).detail ??
          (body as { error?: string }).error ??
          `Request failed (${res.status})`;
        return false;
      }
      return true;
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Request failed";
      return false;
    } finally {
      stepBusyId = null;
    }
  }

  /**
   * Persist step field overlays + segment reorder + linear graph. Reorder uses the two-phase bump
   * sequence (`patchStepOrderIndices`) then a refresh so field PATCHes see current `orderIndex`.
   * Does not flush policy queue — use `persistFlowDraftsToServer` for the full apply pipeline.
   */
  async function persistAllPendingStepsToServer(): Promise<boolean> {
    if (!data.project || !data.route) return false;
    stepError = "";
    const mergedSnapshot = data.steps.map((s) => localRouteStepById[s.id] ?? s);
    const orderChanged = mergedSnapshot.some((s) => {
      const sv = data.steps.find((x) => x.id === s.id);
      return sv != null && sv.orderIndex !== s.orderIndex;
    });
    try {
      if (orderChanged) {
        const orderedIds = [...mergedSnapshot].sort((a, b) => a.orderIndex - b.orderIndex).map((s) => s.id);
        const okOrder = await patchStepOrderIndices(orderedIds);
        if (!okOrder) return false;
        const okGraph = await persistLinearRouteGraph(orderedIds);
        if (!okGraph) return false;
        await refreshRouteDetail();
        await tick();
      }
      const ids = Object.keys(localRouteStepById).filter((id) => stepCommittedDiffersFromServer(id));
      if (ids.length > 0) {
        for (const id of ids) {
          const row = localRouteStepById[id];
          const ok = await persistStepFromRow(id, row);
          if (!ok) return false;
        }
        await refreshRouteDetail();
        await tick();
      }
      localRouteStepById = {};
      return true;
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Apply failed";
      return false;
    }
  }

  async function flushPendingPolicyOps(): Promise<boolean> {
    if (!data.route) return true;
    policyError = "";
    stepPolicyInspectorError = "";
    const ops = [...pendingPolicyOps];
    for (const op of ops) {
      if (op.kind === "bind_route") {
        const res = await fetch(`${DASHBOARD_BASE}/api/policies/${op.policyId}/bindings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType: "route", targetId: data.route.id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          policyError =
            (body as { error?: string }).error ??
            (res.status === 409 ? "Conflict" : `Bind failed (${res.status})`);
          return false;
        }
      } else if (op.kind === "bind_step") {
        const res = await fetch(`${DASHBOARD_BASE}/api/policies/${op.policyId}/bindings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType: "route_step", targetId: op.stepId }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          stepPolicyInspectorError =
            (body as { error?: string }).error ??
            (res.status === 409 ? "Conflict" : `Attach failed (${res.status})`);
          return false;
        }
      } else {
        const res = await fetch(`${DASHBOARD_BASE}/api/policies/${op.policyId}/bindings/${op.bindingId}`, {
          method: "DELETE",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          policyError = (body as { error?: string }).error ?? `Remove failed (${res.status})`;
          return false;
        }
      }
    }
    pendingPolicyOps = [];
    return true;
  }

  async function persistFlowDraftsToServer(): Promise<boolean> {
    if (!data.project || !data.route) return false;
    stepError = "";
    policyError = "";
    stepPolicyInspectorError = "";
    inspectorSaving = true;
    try {
      const okSteps = await persistAllPendingStepsToServer();
      if (!okSteps) return false;
      const okPol = await flushPendingPolicyOps();
      if (!okPol) return false;
      await refreshRouteDetail();
      await tick();
      await tick();
      if (expandedStepId) {
        const st = data.steps.find((s) => s.id === expandedStepId);
        if (st) startEditStep(st);
      }
      return true;
    } finally {
      inspectorSaving = false;
    }
  }

  async function saveRouteFromSetupTab() {
    if (!routeDirty) return;
    routeSaving = true;
    saveError = "";
    try {
      await persistRoute();
    } finally {
      routeSaving = false;
    }
  }

  function openAddStepDialog(anchorId: string | null) {
    addStepAnchorId = anchorId;
    addStepDialogEl?.showModal();
  }

  function closeAddStepDialog() {
    addStepDialogEl?.close();
  }

  /** Add a step from the shared dialog (append, or insert after `addStepAnchorId`). */
  async function submitAddStepFromDialog() {
    if (!data.project || !data.route) return;
    const anchor = addStepAnchorId;
    creatingStep = true;
    stepError = "";
    try {
      const nextOrder = data.steps.length ? Math.max(...data.steps.map((s) => s.orderIndex)) + 1 : 0;
      const timeoutNum = parseInt(stepTimeoutMs, 10);
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIndex: nextOrder,
          providerPreference: stepProviderPreference || null,
          modelId: stepModelId.trim() || null,
          fallbackOn: stepFallbackOn || "error",
          timeoutMs: Number.isFinite(timeoutNum) ? timeoutNum : 12000,
          enabled: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        stepError =
          (body as { detail?: string; error?: string }).detail ??
          (body as { error?: string }).error ??
          `Request failed (${res.status})`;
        return;
      }
      const newId = (body as { data?: { id?: string } }).data?.id;
      if (!newId) {
        stepError = "Create step did not return an id.";
        return;
      }
      const prevOrdered = [...data.steps].sort((a, b) => a.orderIndex - b.orderIndex).map((s) => s.id);
      let nextIds: string[];
      if (anchor === null) {
        nextIds = [...prevOrdered, newId];
      } else {
        const ai = prevOrdered.indexOf(anchor);
        if (ai < 0) {
          stepError = "Could not place the new step — anchor missing. Try again.";
          await refreshRouteDetail();
          return;
        }
        nextIds = [...prevOrdered.slice(0, ai + 1), newId, ...prevOrdered.slice(ai + 1)];
        const okOrder = await patchStepOrderIndices(nextIds);
        if (!okOrder) {
          await refreshRouteDetail();
          return;
        }
      }
      if (nextIds.length > 0) {
        await persistLinearRouteGraph(nextIds);
      }
      stepModelId = "";
      await refreshRouteDetail();
      closeAddStepDialog();
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Request failed";
    } finally {
      creatingStep = false;
    }
  }

  /** POST a new step in parallel group `gid`, then move it next to the group’s last member (not at route end). */
  async function addParallelStepToGroup(groupId: string) {
    if (!data.project || !data.route) return;
    const gid = groupId.trim();
    if (!gid) return;
    addParallelModelBusy = true;
    stepError = "";
    try {
      const members = data.steps.filter((s) => (s.parallelGroupId?.trim() ?? "") === gid);
      if (members.length >= 3) {
        stepError = "Parallel group allows at most three models.";
        return;
      }
      const role =
        members.find((m) => (m.parallelBranchRole?.trim() ?? ""))?.parallelBranchRole?.trim() ?? "fan_out";
      const nextOrder = data.steps.length ? Math.max(...data.steps.map((s) => s.orderIndex)) + 1 : 0;
      const timeoutNum = parseInt(stepTimeoutMs, 10);
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIndex: nextOrder,
          providerPreference: stepProviderPreference || "openai",
          modelId: null,
          fallbackOn: stepFallbackOn || "error",
          timeoutMs: Number.isFinite(timeoutNum) ? timeoutNum : 12000,
          enabled: true,
          parallelGroupId: gid,
          parallelBranchRole: role,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        stepError =
          (body as { detail?: string; error?: string }).detail ??
          (body as { error?: string }).error ??
          `Request failed (${res.status})`;
        return;
      }
      const newId = (body as { data?: { id?: string } }).data?.id;
      if (!newId) {
        stepError = "Create step did not return an id.";
        return;
      }
      await refreshRouteDetail();
      const ordered = [...data.steps].sort((a, b) => a.orderIndex - b.orderIndex);
      const membersExNew = ordered.filter((s) => (s.parallelGroupId?.trim() ?? "") === gid && s.id !== newId);
      const insertAfter = membersExNew.length ? membersExNew[membersExNew.length - 1].id : null;
      if (insertAfter) {
        const ok = await reorderNewParallelStep(insertAfter, newId);
        if (!ok && !stepError) stepError = "Could not reorder the new parallel step.";
      } else {
        await persistLinearRouteGraph(ordered.map((s) => s.id));
        await refreshRouteDetail();
      }
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Request failed";
    } finally {
      addParallelModelBusy = false;
    }
  }

  /** Turn a linear-only step into a parallel group and add a second branch (configure models in the step panel). */
  async function addParallelBranchFromLinearStep(anchorStepId: string) {
    if (!data.project || !data.route) return;
    const anchor = data.steps.find((s) => s.id === anchorStepId);
    if (!anchor) {
      stepError = "Step not found.";
      return;
    }
    if ((anchor.parallelGroupId ?? "").trim()) {
      stepError = "This step is already in a parallel group.";
      return;
    }
    addParallelModelBusy = true;
    stepError = "";
    const gid = newParallelGroupId();
    try {
      const patchRes = await fetch(
        `${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps/${anchorStepId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parallelGroupId: gid,
            parallelBranchRole: "fan_out",
          }),
        }
      );
      const patchBody = await patchRes.json().catch(() => ({}));
      if (!patchRes.ok) {
        stepError =
          (patchBody as { detail?: string; error?: string }).detail ??
          (patchBody as { error?: string }).error ??
          `Could not start parallel group (${patchRes.status})`;
        return;
      }
      await refreshRouteDetail();
      const timeoutNum = parseInt(stepTimeoutMs, 10);
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIndex: data.steps.length ? Math.max(...data.steps.map((s) => s.orderIndex)) + 1 : 0,
          providerPreference: stepProviderPreference || "openai",
          modelId: null,
          fallbackOn: stepFallbackOn || "error",
          timeoutMs: Number.isFinite(timeoutNum) ? timeoutNum : 12000,
          enabled: true,
          parallelGroupId: gid,
          parallelBranchRole: "fan_out",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        stepError =
          (body as { detail?: string; error?: string }).detail ??
          (body as { error?: string }).error ??
          `Request failed (${res.status})`;
        return;
      }
      const newId = (body as { data?: { id?: string } }).data?.id;
      if (!newId) {
        stepError = "Create step did not return an id.";
        return;
      }
      const ok = await reorderNewParallelStep(anchorStepId, newId);
      if (!ok && !stepError) stepError = "Could not place the new parallel step next to the first branch.";
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Request failed";
    } finally {
      addParallelModelBusy = false;
    }
  }

  async function addParallelBranchForStep(stepId: string) {
    const step = data.steps.find((s) => s.id === stepId);
    if (!step) return;
    const gid = (step.parallelGroupId ?? "").trim();
    if (gid) await addParallelStepToGroup(gid);
    else await addParallelBranchFromLinearStep(stepId);
  }

  async function removeStep(stepId: string) {
    if (!data.project || !data.route) return;
    stepBusyId = stepId;
    stepError = "";
    const remainingIds = orderedSteps
      .filter((s) => s.id !== stepId)
      .map((s) => s.id);
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/routes/${data.route.id}/steps/${stepId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (expandedStepId === stepId) {
          expandedStepId = null;
          editingStepId = null;
        }
        if (localRouteStepById[stepId]) {
          const next = { ...localRouteStepById };
          delete next[stepId];
          localRouteStepById = next;
        }
        await persistLinearRouteGraph(remainingIds);
        await refreshRouteDetail();
      }
      else stepError = "Failed to remove step";
    } catch (e) {
      stepError = e instanceof Error ? e.message : "Failed to remove step";
    } finally {
      stepBusyId = null;
    }
  }

  function startEditStep(step: {
    id: string;
    providerPreference: string | null;
    modelId: string | null;
    fallbackOn: string | null;
    timeoutMs: number | null;
    enabled: boolean;
    label?: string | null;
    switchCriteria?: Record<string, unknown> | null;
    retryPolicy?: Record<string, unknown> | null;
    costPolicy?: Record<string, unknown> | null;
    notes?: string | null;
    modelPool?: Record<string, unknown> | null;
    parallelGroupId?: string | null;
    parallelBranchRole?: string | null;
  }) {
    editingStepId = step.id;
    expandedStepId = step.id;
    editingProviderPreference = step.providerPreference ?? "openai";
    editingModelId = step.modelId ?? "";
    editingFallbackOn = step.fallbackOn ?? "error";
    editingTimeoutMs = String(step.timeoutMs ?? 12000);
    editingLabel = clampRouteStepLabel(step.label ?? "");
    editingSwitchCriteriaText = stringifyJsonField(step.switchCriteria ?? undefined);
    editingRetryPolicyText = stringifyJsonField(step.retryPolicy ?? undefined);
    editingCostPolicyText = stringifyJsonField(step.costPolicy ?? undefined);
    editingNotesText = step.notes ?? "";
    editingModelPoolText = stringifyJsonField(step.modelPool ?? undefined);
    editingParallelGroupId = step.parallelGroupId ?? "";
    editingParallelBranchRole = step.parallelBranchRole ?? "";
    stepLabelEditMode = false;
    stepError = "";
    stepPolicyInspectorError = "";
  }

  function beginStepLabelEdit() {
    stepLabelEditMode = true;
    void tick().then(() => {
      stepLabelInputEl?.focus();
      stepLabelInputEl?.select();
    });
  }

  /** Last bound value can lag behind the DOM when leaving rename (Done / unmount); keep dirty state in sync. */
  function syncStepLabelFromInput() {
    if (stepLabelInputEl) editingLabel = stepLabelInputEl.value;
  }

  async function finishStepLabelEdit() {
    syncStepLabelFromInput();
    stepLabelEditMode = false;
    await tick();
  }

  /** Discard drafts: clear locally merged step overlays and reset the open inspector from the server. */
  function revertInspectorFromToolbar() {
    localRouteStepById = {};
    pendingPolicyOps = [];
    if (expandedStepId) {
      const st = data.steps.find((s) => s.id === expandedStepId);
      if (st) startEditStep(st);
    }
    stepError = "";
  }

  function cancelStepLabelEdit() {
    const st = data.steps.find((s) => s.id === expandedStepId);
    editingLabel = clampRouteStepLabel(st?.label ?? "");
    stepLabelEditMode = false;
  }

  function bindPolicyToSelectedStep() {
    if (!expandedStepId || !selectedPolicyId || !data.route) return;
    if (policyIdsUnavailableForStepGuardAttach.includes(selectedPolicyId)) {
      stepPolicyInspectorError =
        "This guard rail is already attached to the route or to this model. Remove it first, or pick another.";
      return;
    }
    stepPolicyInspectorError = "";
    pendingPolicyOps = [
      ...pendingPolicyOps,
      { kind: "bind_step", policyId: selectedPolicyId, stepId: expandedStepId },
    ];
    selectedPolicyId = "";
  }

  /** Undo a queued bind before **Apply to server** (synthetic binding ids only). */
  function cancelPendingBindForSynthetic(bindingId: string): boolean {
    if (!bindingId.startsWith("pending-bind:")) return false;
    if (bindingId.startsWith("pending-bind:route:")) {
      const policyId = bindingId.slice("pending-bind:route:".length);
      pendingPolicyOps = pendingPolicyOps.filter((op) => !(op.kind === "bind_route" && op.policyId === policyId));
      return true;
    }
    if (bindingId.startsWith("pending-bind:step:")) {
      const rest = bindingId.slice("pending-bind:step:".length);
      const colon = rest.indexOf(":");
      if (colon < 1) return false;
      const stepId = rest.slice(0, colon);
      const policyId = rest.slice(colon + 1);
      pendingPolicyOps = pendingPolicyOps.filter(
        (op) => !(op.kind === "bind_step" && op.stepId === stepId && op.policyId === policyId)
      );
      return true;
    }
    return false;
  }

  function unbindStepPolicyBinding(policyId: string, bindingId: string) {
    stepPolicyInspectorError = "";
    if (cancelPendingBindForSynthetic(bindingId)) return;
    pendingPolicyOps = [...pendingPolicyOps, { kind: "unbind", policyId, bindingId }];
  }

  /** @returns whether the parent inspector selection may move to `step` (canvas uses this to sync highlight). */
  function selectStepFromCanvas(step: (typeof data.steps)[number]): boolean {
    if (expandedStepId === step.id) {
      pendingInspectorStep = null;
      return true;
    }
    /**
     * Only block when the *inspector* has unsaved field edits for the open model. Map-only drafts
     * must not block picking a card — otherwise `pendingInspectorStep` is set but the switch guard
     * never renders when no model is selected yet (`expandedStepId` is null).
     */
    if (
      (stepDirty || inspectorPendingServerPatch || policyDraftPending) &&
      expandedStepId != null &&
      expandedStepId !== step.id
    ) {
      pendingInspectorStep = step;
      return false;
    }
    startEditStep(step);
    return true;
  }

  function cancelPendingInspectorSwitch() {
    pendingInspectorStep = null;
  }

  function discardPendingInspectorSwitch() {
    const target = pendingInspectorStep;
    if (!target) return;
    pendingInspectorStep = null;
    pendingPolicyOps = [];
    routeFlowCanvasRef?.revertRouteDraft();
    startEditStep(target);
  }

  async function saveAndSwitchToPendingInspectorStep() {
    const target = pendingInspectorStep;
    if (!target) return;
    if (stepDirty) {
      const mergedOk = await commitAllEditingToLocalRouteMap();
      if (!mergedOk) return;
    }
    const ok =
      routeFlowCanvasRef && typeof routeFlowCanvasRef.applyRouteDraft === "function"
        ? await routeFlowCanvasRef.applyRouteDraft()
        : await persistFlowDraftsToServer();
    if (!ok) return;
    startEditStep(target);
  }

  function goToRouteSetupTab() {
    workspaceTab = "setup";
  }

  function toggleStepEnabled(stepId: string, enabled: boolean) {
    if (!data.project || !data.route) return;
    const ordered = [...displaySteps].sort((a, b) => a.orderIndex - b.orderIndex);
    const stepsForGuard = ordered.map((s) => ({
      id: s.id,
      orderIndex: s.orderIndex,
      enabled: s.id === stepId ? enabled : s.enabled,
      parallelGroupId: s.parallelGroupId ?? null,
    }));
    const blockMsg = getPrimaryChainEnableBlockMessage({ steps: stepsForGuard, stepId, nextEnabled: enabled });
    if (blockMsg) {
      stepError = blockMsg;
      return;
    }
    stepError = "";
    const base = displaySteps.find((s) => s.id === stepId);
    if (!base) return;
    localRouteStepById = { ...localRouteStepById, [stepId]: { ...base, enabled } };
  }

  function moveStep(stepId: string, direction: "up" | "down") {
    if (!data.project || !data.route) return;
    const ordered = [...displaySteps].sort((a, b) => a.orderIndex - b.orderIndex);
    const segments = buildRouteFlowSegments(ordered);
    const segIndex = segments.findIndex((seg) => seg.steps.some((s) => s.id === stepId));
    if (segIndex < 0) return;
    const neighbor = direction === "up" ? segIndex - 1 : segIndex + 1;
    if (neighbor < 0 || neighbor >= segments.length) return;
    const nextSegments = [...segments];
    [nextSegments[segIndex], nextSegments[neighbor]] = [nextSegments[neighbor], nextSegments[segIndex]];
    const flatIds = routeFlowSegmentListToStepIds(nextSegments);
    stepError = "";
    const nextOverlay: Record<string, (typeof data.steps)[number]> = { ...localRouteStepById };
    for (let i = 0; i < flatIds.length; i++) {
      const id = flatIds[i];
      const server = data.steps.find((x) => x.id === id);
      if (!server) continue;
      const base = displaySteps.find((x) => x.id === id) ?? server;
      nextOverlay[id] = { ...base, orderIndex: i };
    }
    localRouteStepById = nextOverlay;
  }

  function bindPolicy(policyId: string) {
    if (!policyId || !data.route) return;
    if (policyIdsUnavailableForRouteGuardAttach.includes(policyId)) {
      policyError =
        "This guard rail is already attached to the route or a model. Remove it first, or pick another.";
      return;
    }
    policyError = "";
    pendingPolicyOps = [...pendingPolicyOps, { kind: "bind_route", policyId }];
    selectedPolicyId = "";
  }

  async function createAndBindPolicy(scope: "route" | "step" = "route") {
    if (!createPolicyName.trim() || !data.route) return;
    creatingAndBindingPolicy = true;
    policyError = "";
    stepPolicyInspectorError = "";
    try {
      const createRes = await fetch(`${DASHBOARD_BASE}/api/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createPolicyName.trim(), type: createPolicyType }),
      });
      const body = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !body.data?.id) {
        policyError = (body as { error?: string }).error ?? `Request failed (${createRes.status})`;
        return;
      }
      const policyId = body.data.id as string;
      if (scope === "route") {
        bindPolicy(policyId);
        if (!policyError) createPolicyName = "";
      } else {
        if (!expandedStepId) {
          policyError = "Select a model on the flow map before attaching a guard rail to this model only.";
          return;
        }
        stepPolicyInspectorError = "";
        pendingPolicyOps = [...pendingPolicyOps, { kind: "bind_step", policyId, stepId: expandedStepId }];
        selectedPolicyId = "";
        createPolicyName = "";
      }
    } catch (e) {
      policyError = e instanceof Error ? e.message : "Request failed";
    } finally {
      creatingAndBindingPolicy = false;
    }
  }

  function unbindPolicy(policyId: string, bindingId: string) {
    policyError = "";
    if (cancelPendingBindForSynthetic(bindingId)) return;
    pendingPolicyOps = [...pendingPolicyOps, { kind: "unbind", policyId, bindingId }];
  }
</script>

{#if data.error || !data.route || !data.project}
  <p class="error-msg" role="alert">{data.error ?? "Route not found."}</p>
  <p><a href={DASHBOARD_BASE + "/routes"} class="back-link">← Back to Routes</a></p>
{:else}
  <div class="route-editor-shell">
    <header class="route-page-header">
      <div class="route-page-top">
        <div class="route-page-heading">
          <nav class="route-breadcrumb" aria-label="Breadcrumb">
            <a href={DASHBOARD_BASE + "/projects/" + data.project.id + "/routes"} class="back-link"
              >← Routes · {data.project.name}</a
            >
            <span class="route-breadcrumb-sep" aria-hidden="true">/</span>
            <span class="route-breadcrumb-current">{data.route.name}</span>
          </nav>
          <h1 class="page-title route-page-title" id="route-page-title" aria-describedby="route-page-lede">
            {data.route.name}
          </h1>
          <p class="page-desc" id="route-page-lede">
            Edit this route’s provider chain, guard rails, and settings. Use <strong>Flow map</strong> for steps and
            order; <strong>Configuration</strong> for name, description, status, billing, and optional ingestion routing.
          </p>
        </div>
      </div>

  {#if data.route.version != null && data.route.publishedVersion != null && data.route.version !== data.route.publishedVersion}
    <div class="publish-draft-banner" role="status">
      <strong>Draft route:</strong> working version {data.route.version} differs from published version {data.route.publishedVersion}.
      Publish from version history when this route should receive discovery traffic.
    </div>
  {/if}

  {#if data.modelLifecycleWarnings?.length > 0}
    <div class="lifecycle-warning" role="alert">
      <strong>Models in this route are deprecated or retiring.</strong>
      <ul>
        {#each data.modelLifecycleWarnings as m}
          <li>
            <a href={DASHBOARD_BASE + "/models/" + m.id}>{m.canonicalName}</a>
            {#if m.lifecycleState}<span class="lifecycle-state">({m.lifecycleState})</span>{/if}
            {#if m.replacementModelId}
              — consider <a href={DASHBOARD_BASE + "/models/" + m.replacementModelId}>replacement model</a>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if saveError}
    <p class="error-msg" role="alert">{saveError}</p>
  {/if}

      <div class="route-workspace-tabs" role="tablist" aria-label="Route editor sections">
        <button
          type="button"
          role="tab"
          class="route-tab"
          class:route-tab-active={workspaceTab === "flow"}
          aria-selected={workspaceTab === "flow"}
          id="route-tab-flow"
          aria-controls="route-panel-flow"
          onclick={() => (workspaceTab = "flow")}
        >
          Flow map
        </button>
        <button
          type="button"
          role="tab"
          class="route-tab"
          class:route-tab-active={workspaceTab === "setup"}
          aria-selected={workspaceTab === "setup"}
          id="route-tab-setup"
          aria-controls="route-panel-setup"
          onclick={() => (workspaceTab = "setup")}
        >
          Configuration
          {#if effectiveRoutePolicyBindings.length > 0}
            <span class="route-tab-badge">{effectiveRoutePolicyBindings.length}</span>
          {/if}
        </button>
        <button
          type="button"
          role="tab"
          class="route-tab"
          class:route-tab-active={workspaceTab === "more"}
          aria-selected={workspaceTab === "more"}
          id="route-tab-more"
          aria-controls="route-panel-more"
          onclick={() => (workspaceTab = "more")}
        >
          More
        </button>
      </div>
    </header>

  {#if workspaceTab === "flow"}
    <div id="route-panel-flow" role="tabpanel" aria-labelledby="route-tab-flow" tabindex="0" class="route-tab-panel route-flow-shell">
      <div
        class="route-flow-draft-status"
        class:route-flow-draft-status--pending={flowDraftPendingServer}
        class:route-flow-draft-status--synced={!flowDraftPendingServer}
        role="status"
        aria-live="polite"
      >
        {#if flowDraftPendingServer}
          <p class="route-flow-draft-status-msg">
            <strong>Draft</strong> — not on server. Use <strong>Apply to server</strong> on the map. Leaving may discard local edits.
          </p>
        {:else}
          <p class="route-flow-draft-status-msg">
            <strong>On server</strong>{#if flowLastSavedLabel}<span class="route-flow-draft-status-time"> · Last updated {flowLastSavedLabel}</span>{/if}
          </p>
        {/if}
      </div>
      <div class="route-flow-canvas-row">
        <div class="route-flow-main">
          <div
            id="flow-panel-visual"
            role="region"
            aria-label="Route flow map"
            tabindex="0"
            class="flow-editor-panel route-visual-panel"
          >
            {#if stepError}
              <p class="error-msg route-flow-step-error" role="alert">{stepError}</p>
            {/if}
            {#if data.route && data.project}
              <RouteFlowCanvas
                bind:this={routeFlowCanvasRef}
                projectId={data.project.id}
                routeId={data.route.id}
                steps={displaySteps}
                stepLinks={data.routeStepLinks}
                flowLayout={data.route.flowLayout ?? null}
                entryStepId={data.route.entryStepId ?? null}
                addParallelBusy={addParallelModelBusy}
                onAddParallelBranch={(stepId) => void addParallelBranchForStep(stepId)}
                onRequestAddLinearStep={(anchorId) => openAddStepDialog(anchorId)}
                selectedInspectorStepId={expandedStepId}
                inspectorPendingServerPatch={flowInspectorApplyDirty}
                inspectorSaving={inspectorSaving}
                onCommitInspectorDraft={() => persistFlowDraftsToServer()}
                onRevertInspectorDraft={() => revertInspectorFromToolbar()}
                onToolbarBusyChange={(busy) => {
                  flowToolbarSaving = busy;
                }}
                onMapDraftDirty={(d) => {
                  mapDraftDirty = d;
                }}
                onFlowAppliedToServer={() => {
                  lastClientFlowApplyAtMs = Date.now();
                }}
                onStepSelected={(id) => {
                  const st = data.steps.find((s) => s.id === id);
                  if (!st) return false;
                  return selectStepFromCanvas(st);
                }}
              />
            {/if}
          </div>
        </div>

    <aside
      class="route-inspector-panel"
      aria-label={inspectorHeadStep ? `Inspector · ${inspectorHeadTitle}` : "Model inspector"}
    >
      <div class="drawer-toolbar">
        <div class="drawer-toolbar-start">
          {#if inspectorHeadStep}
            <div class="drawer-step-header-block">
            <div class="drawer-step-title-row">
              {#if !stepLabelEditMode}
                <h2
                  id="drawer-step-heading"
                  class="drawer-step-title"
                  title={inspectorHeadTitle}
                  aria-describedby="drawer-step-desc"
                >
                  {inspectorHeadTitle}
                </h2>
                <button
                  type="button"
                  class="drawer-step-rename-link"
                  onclick={() => beginStepLabelEdit()}
                >
                  Rename
                </button>
              {:else}
                <input
                  id="drawer-step-heading"
                  bind:this={stepLabelInputEl}
                  class="input drawer-step-label-input"
                  bind:value={editingLabel}
                  maxlength={ROUTE_STEP_LABEL_MAX_LENGTH}
                  placeholder={`Step ${inspectorHeadStep.orderIndex + 1}`}
                  aria-label="Step label (optional)"
                  aria-describedby="drawer-step-desc drawer-step-label-limit"
                  onkeydown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelStepLabelEdit();
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      void finishStepLabelEdit();
                    }
                  }}
                />
                <button type="button" class="drawer-step-rename-link" onclick={() => void finishStepLabelEdit()}>
                  Done
                </button>
              {/if}
            </div>
            <p class="drawer-step-desc" id="drawer-step-desc">
              {#if stepLabelEditMode}
                <strong>Enter</strong> or <strong>Done</strong>, then <strong>Apply changes</strong> in Call settings (local map only).
              {:else}
                <strong>Apply changes</strong> in Call settings / Advanced updates the local map; <strong>Apply to server</strong> on the map saves.
              {/if}
            </p>
            {#if stepLabelEditMode}
              <p class="drawer-step-label-limit" id="drawer-step-label-limit">
                Max {ROUTE_STEP_LABEL_MAX_LENGTH} characters (fits the map card).
              </p>
            {/if}
            </div>
          {:else}
            <div class="drawer-inspector-empty-toolbar">
              <h2 id="drawer-inspector-heading" class="drawer-step-title">Model inspector</h2>
              <p class="muted drawer-inspector-empty-lede">
                Select a model on the map to edit providers, labels, and order.
              </p>
            </div>
          {/if}
        </div>
      </div>
      {#if pendingInspectorStep && resolvedInspectorBaseline}
        <div class="inspector-switch-guard" role="alert">
          <p class="inspector-switch-guard-msg">
            Unsaved draft for this route (map and/or <strong>{stepSummaryLabel(resolvedInspectorBaseline)}</strong>). Open
            <strong>{stepSummaryLabel(pendingInspectorStep)}</strong>?
          </p>
          <div class="inspector-switch-guard-actions">
            <button
              type="button"
              class="btn btn-primary btn-inline"
              onclick={() => void saveAndSwitchToPendingInspectorStep()}
              disabled={inspectorSaving || flowToolbarSaving}
            >
              {inspectorSaving || flowToolbarSaving ? "Applying…" : "Apply to server and open"}
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-inline"
              onclick={() => discardPendingInspectorSwitch()}
              disabled={inspectorSaving || flowToolbarSaving}
            >
              Discard and open
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-inline"
              onclick={() => cancelPendingInspectorSwitch()}
              disabled={inspectorSaving || flowToolbarSaving}
            >
              Stay here
            </button>
          </div>
        </div>
      {/if}
      <div class="drawer-body">
        {#if stepError}
          <p class="error-msg drawer-inline-error" role="alert">{stepError}</p>
        {/if}
      <section
        id="route-inspector-step"
        class="inspector-section"
        aria-labelledby={inspectorHeadStep ? "drawer-step-heading" : "drawer-inspector-heading"}
      >
        {#if displaySteps.some((s) => s.id === expandedStepId)}
          {@const inspStep = displaySteps.find((s) => s.id === expandedStepId)}
          {#if inspStep}
            {@const stepQuickActionsBusy = stepBusyId === inspStep.id}
            <div class="inspector-disclosures-stack">
              <details class="inspector-disclosure">
                <summary class="inspector-disclosure-summary" id="inspector-order-heading">Order &amp; status</summary>
                <div class="inspector-disclosure-body">
                  <div
                    class="step-panel-actions"
                    role="group"
                    aria-labelledby="inspector-order-heading"
                    aria-busy={stepQuickActionsBusy ? "true" : "false"}
                  >
                    {#if canReorderSegmentUp}
                      <button
                        type="button"
                        class="btn btn-secondary btn-inline step-panel-actions-btn"
                        onclick={(e) => {
                          e.stopPropagation();
                          void moveStep(inspStep.id, "up");
                        }}
                        disabled={stepQuickActionsBusy}
                      >
                        Move up
                      </button>
                    {/if}
                    {#if canReorderSegmentDown}
                      <button
                        type="button"
                        class="btn btn-secondary btn-inline step-panel-actions-btn"
                        onclick={(e) => {
                          e.stopPropagation();
                          void moveStep(inspStep.id, "down");
                        }}
                        disabled={stepQuickActionsBusy}
                      >
                        Move down
                      </button>
                    {/if}
                    <button
                      type="button"
                      class="btn btn-secondary btn-inline step-panel-actions-btn"
                      onclick={(e) => {
                        e.stopPropagation();
                        void toggleStepEnabled(inspStep.id, !inspStep.enabled);
                      }}
                      disabled={stepQuickActionsBusy}
                    >
                      {inspStep.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                  {#if selectedSegmentIndex >= 0 && reorderSegmentsForMove[selectedSegmentIndex]?.type === "parallel"}
                    <p class="inspector-lede muted inspector-lede--tight" role="note">
                      Parallel segment: <strong>Move up</strong> / <strong>Move down</strong> repositions the whole segment
                      in the chain.
                    </p>
                  {/if}
                </div>
              </details>

              <details class="inspector-disclosure">
                <summary class="inspector-disclosure-summary" id="inspector-runtime-heading">Call settings</summary>
                <div class="inspector-disclosure-body">
                  <p class="inspector-lede--runtime-hint">
                    Provider, model, fallback, timeout. Optional label: <strong>Rename</strong> in the header (merged here). <strong>Apply changes</strong> → local map;
                    <strong>Apply to server</strong> on the map → API.
                  </p>
                  <div class="inspector-runtime-fields">
                    <div class="form-row compact">
                      <label for="edit-step-provider">Provider</label>
                      <select id="edit-step-provider" bind:value={editingProviderPreference} class="input">
                        <option value="openai">openai</option>
                        <option value="anthropic">anthropic</option>
                        <option value="google">google</option>
                        <option value="openrouter">openrouter</option>
                        <option value="vercel">vercel</option>
                        <option value="portkey">portkey</option>
                        <option value="voyage">voyage</option>
                      </select>
                    </div>
                    <div class="form-row compact">
                      <label for="edit-step-model">Model</label>
                      <select id="edit-step-model" class="input" bind:value={editingModelId}>
                        <option value="">— none —</option>
                        {#each modelIdsForProvider(editingProviderPreference) as mid (mid)}
                          <option value={mid}>{modelCatalogLabel(mid)}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="form-row compact">
                      <label for="edit-step-fallback">Trigger fallback when:</label>
                      <select id="edit-step-fallback" bind:value={editingFallbackOn} class="input">
                        <option value="error">error</option>
                        <option value="rate_limit">rate_limit</option>
                        <option value="no_key">no_key</option>
                        <option value="policy_block">policy_block</option>
                        <option value="any">any</option>
                      </select>
                    </div>
                    <div class="form-row compact">
                      <label for="edit-step-timeout">Change model after (ms)</label>
                      <input id="edit-step-timeout" class="input" bind:value={editingTimeoutMs} />
                    </div>
                  </div>
                  <div class="inspector-section-apply">
                    <button
                      type="button"
                      class="btn btn-primary inspector-section-apply-btn"
                      disabled={!callSettingsSectionDirty || inspectorSaving || flowToolbarSaving}
                      onclick={() => void commitCallSettingsToLocalRouteMap()}
                      aria-label="Merge call settings and step label into the local route map draft"
                    >
                      Apply changes
                    </button>
                  </div>
                </div>
              </details>

              <details class="inspector-disclosure route-inspector-advanced-guard">
                <summary class="inspector-disclosure-summary">Guard rails</summary>
                <div class="inspector-disclosure-body">
                  {#if data.route && data.project}
                    <div class="route-inspector-guard-shell">
                      <RouteGuardRailsPanel
                        idPrefix="flow-inspector"
                        compact
                        bindGuardRailToStep={true}
                        otherModelsStepGuardRails={otherModelsStepGuardRails}
                        policyIdsUnavailableForRouteAttach={policyIdsUnavailableForRouteGuardAttach}
                        policyIdsUnavailableForStepAttach={policyIdsUnavailableForStepGuardAttach}
                        inspectorStepId={inspStep.id}
                        selectedStepSummary={editingLabel.trim()
                          ? editingLabel.trim()
                          : `Step ${inspStep.orderIndex + 1}`}
                        stepBindings={bindingsForInspectorStep}
                        stepInspectorError={stepPolicyInspectorError}
                        stepUnbindBusyId={stepUnbindBusyId}
                        onUnbindStepBinding={(policyId, bindingId) =>
                          void unbindStepPolicyBinding(policyId, bindingId)}
                        stepBindingBusy={stepBindingBusy}
                        onBindGuardRailToStep={() => void bindPolicyToSelectedStep()}
                        availablePolicies={data.availablePolicies}
                        routePolicyBindings={effectiveRoutePolicyBindings}
                        bind:selectedPolicyId
                        bind:createPolicyName
                        bind:createPolicyType
                        policyError={policyError}
                        bindingPolicy={bindingPolicy}
                        creatingAndBindingPolicy={creatingAndBindingPolicy}
                        unbindingId={unbindingId}
                        onAttach={() => void bindPolicy(selectedPolicyId)}
                        onCreateBind={(scope) => void createAndBindPolicy(scope)}
                        onUnbind={(policyId, bindingId) => void unbindPolicy(policyId, bindingId)}
                      />
                    </div>
                  {/if}
                </div>
              </details>

              <details class="inspector-disclosure">
                <summary class="inspector-disclosure-summary">Advanced JSON, pools & parallel</summary>
                <div class="inspector-disclosure-body">
                  <p class="muted inspector-disclosure-intro">
                    Optional JSON, pool, parallel — when <strong>Call settings</strong> is not enough.
                  </p>
                  <div class="form-row compact full-width">
                    <label for="edit-step-switch">Switch criteria (JSON object, optional)</label>
                    <textarea id="edit-step-switch" class="input textarea-json" bind:value={editingSwitchCriteriaText} rows="4" spellcheck="false" placeholder={'{}'}></textarea>
                  </div>
                  <div class="form-row compact full-width">
                    <label for="edit-step-retry">Retry policy (JSON object, optional)</label>
                    <textarea id="edit-step-retry" class="input textarea-json" bind:value={editingRetryPolicyText} rows="4" spellcheck="false"></textarea>
                  </div>
                  <div class="form-row compact full-width">
                    <label for="edit-step-cost">Cost policy (JSON object, optional)</label>
                    <textarea id="edit-step-cost" class="input textarea-json" bind:value={editingCostPolicyText} rows="4" spellcheck="false"></textarea>
                  </div>
                  <div class="form-row compact full-width">
                    <label for="edit-step-notes">Operator notes (optional)</label>
                    <textarea id="edit-step-notes" class="input textarea-json" bind:value={editingNotesText} rows="2" spellcheck="true"></textarea>
                  </div>
                  <div class="form-row compact full-width">
                    <label for="edit-step-model-pool">Model pool (JSON, optional)</label>
                    <textarea
                      id="edit-step-model-pool"
                      class="input textarea-json"
                      bind:value={editingModelPoolText}
                      rows="6"
                      spellcheck="false"
                      placeholder={`{\n  "version": 1,\n  "selectionStrategy": "first_eligible",\n  "members": [\n    { "providerPreference": "openai", "modelId": "gpt-4o-mini" }\n  ]\n}`}
                    ></textarea>
                    <p class="muted form-hint">
                      When set, resolve picks the first pool member that passes policy and is executable. Leave empty to use the
                      provider and model in <strong>Call settings</strong> only.
                    </p>
                  </div>
                  <div class="form-row compact">
                    <label for="edit-parallel-group">Parallel group id (optional)</label>
                    <input
                      id="edit-parallel-group"
                      class="input"
                      bind:value={editingParallelGroupId}
                      placeholder="e.g. embed-batch-1"
                      autocomplete="off"
                    />
                  </div>
                  <div class="form-row compact">
                    <label for="edit-parallel-role">Parallel branch role (optional)</label>
                    <input
                      id="edit-parallel-role"
                      class="input"
                      bind:value={editingParallelBranchRole}
                      placeholder="fan_out, fan_in, …"
                      autocomplete="off"
                    />
                  </div>
                  <div class="inspector-section-apply">
                    <button
                      type="button"
                      class="btn btn-primary inspector-section-apply-btn"
                      disabled={!advancedSectionDirty || inspectorSaving || flowToolbarSaving}
                      onclick={() => void commitAdvancedToLocalRouteMap()}
                      aria-label="Merge advanced JSON, pool, and parallel fields into the local route map draft"
                    >
                      Apply changes
                    </button>
                  </div>
                </div>
              </details>
            </div>

            <div class="inspector-step-actions-footer">
              {#if stepRemoveAwaitingConfirmId === inspStep.id}
                <div class="inspector-remove-confirm" role="group" aria-label="Confirm remove model">
                  <p class="inspector-remove-confirm-msg">
                    Remove this model from the route? The flow is rewired; this cannot be undone.
                  </p>
                  <div class="inspector-remove-confirm-actions">
                    <button
                      type="button"
                      class="btn btn-secondary btn-inline"
                      onclick={() => {
                        stepRemoveAwaitingConfirmId = null;
                      }}
                      disabled={stepBusyId === inspStep.id}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      class="btn btn-danger btn-inline"
                      onclick={() => void removeStep(inspStep.id)}
                      disabled={stepBusyId === inspStep.id}
                    >
                      {stepBusyId === inspStep.id ? "Removing…" : "Remove model"}
                    </button>
                  </div>
                </div>
              {:else}
                <button
                  type="button"
                  class="btn btn-danger inspector-step-remove-btn"
                  onclick={() => {
                    stepRemoveAwaitingConfirmId = inspStep.id;
                  }}
                  disabled={stepBusyId === inspStep.id || inspectorSaving || flowToolbarSaving}
                  aria-label="Remove this model from the route"
                >
                  Remove model
                </button>
              {/if}
            </div>
          {/if}
        {:else}
          <p class="inspector-empty-panel-lede muted">
            Choose a model on the flow map to edit call settings, order, and guard rails.
          </p>
        {/if}
      </section>
      </div>
    </aside>
      </div>

      <dialog
        class="add-step-dialog"
        bind:this={addStepDialogEl}
        aria-labelledby="add-step-dialog-title"
        onclose={() => {
          addStepAnchorId = null;
        }}
      >
        <form
          class="add-step-dialog-form"
          onsubmit={(e) => {
            e.preventDefault();
            void submitAddStepFromDialog();
          }}
        >
          <div class="add-step-dialog-header">
            <h3 id="add-step-dialog-title" class="add-step-dialog-title">Add step</h3>
            {#if addStepAnchorId}
              <p class="add-step-dialog-lede">
                Inserts <strong>after</strong> this point in the chain. Reorder steps on the flow map.
              </p>
            {:else}
              <p class="add-step-dialog-lede">Appends at the end of the chain.</p>
            {/if}
          </div>
          <div class="add-step-dialog-fields">
            <div class="add-step-dialog-grid">
              <div class="add-step-dialog-field">
                <label for="add-step-provider">Provider</label>
                <select id="add-step-provider" bind:value={stepProviderPreference} class="input add-step-dialog-input">
                  <option value="openai">openai</option>
                  <option value="anthropic">anthropic</option>
                  <option value="google">google</option>
                  <option value="openrouter">openrouter</option>
                  <option value="vercel">vercel</option>
                  <option value="portkey">portkey</option>
                  <option value="voyage">voyage</option>
                </select>
              </div>
              <div class="add-step-dialog-field">
                <label for="add-step-model">Model</label>
                <select id="add-step-model" class="input add-step-dialog-input" bind:value={stepModelId}>
                  <option value="">— optional —</option>
                  {#each modelIdsForProvider(stepProviderPreference) as mid (mid)}
                    <option value={mid}>{modelCatalogLabel(mid)}</option>
                  {/each}
                </select>
              </div>
              <div class="add-step-dialog-field">
                <label for="add-step-fallback">Fallback when</label>
                <select id="add-step-fallback" bind:value={stepFallbackOn} class="input add-step-dialog-input">
                  <option value="error">error</option>
                  <option value="rate_limit">rate_limit</option>
                  <option value="no_key">no_key</option>
                  <option value="policy_block">policy_block</option>
                  <option value="any">any</option>
                </select>
              </div>
              <div class="add-step-dialog-field">
                <label for="add-step-timeout">Timeout (ms)</label>
                <input id="add-step-timeout" class="input add-step-dialog-input" bind:value={stepTimeoutMs} inputmode="numeric" />
              </div>
            </div>
          </div>
          <div class="add-step-dialog-actions">
            <button type="button" class="btn btn-secondary" onclick={() => closeAddStepDialog()}>Cancel</button>
            <button type="submit" class="btn btn-primary" disabled={creatingStep}>
              {creatingStep ? "Adding…" : "Add step"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  {:else if workspaceTab === "setup"}
    <div
      id="route-panel-setup"
      role="tabpanel"
      aria-labelledby="route-tab-setup"
      tabindex="0"
      class="route-tab-panel route-setup-panel"
    >
      <section class="section route-setup-route-section" aria-labelledby="route-config-heading">
        <div class="route-setup-section-head">
          <h2 id="route-config-heading" class="section-title">Route</h2>
          <p class="section-desc">
            Core fields for this route, including an optional operator-facing description. Step order and fallback are
            configured in Flow map. Ingestion and pipeline routing are optional; see disclosure below.
          </p>
        </div>
        <form class="config-form" onsubmit={(e) => { e.preventDefault(); }}>
          <div class="form-row">
            <label for="route-setup-name">Name</label>
            <input id="route-setup-name" type="text" bind:value={editName} class="input" />
          </div>
          <div class="form-row">
            <label for="route-setup-description">Description (optional)</label>
            <textarea
              id="route-setup-description"
              class="input route-setup-description"
              bind:value={editDescription}
              rows="3"
              maxlength="2000"
              placeholder="Plain English summary for operators (optional)"
            ></textarea>
            <p class="muted form-hint">For your team’s notes only; not shown in the route header.</p>
          </div>
          <div class="form-row">
            <label for="route-setup-status">Status</label>
            <select id="route-setup-status" bind:value={editStatus} class="input">
              <option value="active">active</option>
              <option value="paused">paused</option>
            </select>
          </div>
          <div class="form-row">
            <label for="route-setup-billing">Who pays for this route?</label>
            <select id="route-setup-billing" bind:value={editBillingMode} class="input">
              <option value="">—</option>
              <option value="pass_through">Pass through</option>
              <option value="metered">Metered</option>
            </select>
          </div>
          <details class="inspector-disclosure">
            <summary class="inspector-disclosure-summary">Ingestion & routing (optional)</summary>
            <div class="inspector-disclosure-body">
              <div class="form-row">
                <label for="route-setup-ingest-workload">Ingestion workload</label>
                <select id="route-setup-ingest-workload" bind:value={editWorkload} class="input">
                  <option value="">— none —</option>
                  <option value={data.ingestionWorkload}>{data.ingestionWorkload}</option>
                </select>
              </div>
              {#if editWorkload === data.ingestionWorkload}
                <div class="form-row">
                  <label for="route-setup-ingest-stage">Ingestion stage</label>
                  <select id="route-setup-ingest-stage" bind:value={editStage} class="input">
                    <option value="">— shared route (null stage) —</option>
                    {#each data.ingestionStageIds as sid}
                      <option value={sid}>{sid}</option>
                    {/each}
                  </select>
                </div>
                <p class="muted">
                  Used by resolve discovery for SOPHIA-style pipelines. Canonical reference:
                  <a href="/keys/docs/guides/routing-contract">Routing contract</a>.
                </p>
              {/if}
            </div>
          </details>
          <div class="route-setup-save-row route-setup-save-row--footer">
            {#if routeDirty}
              <span class="route-setup-unsaved" aria-live="polite">Unsaved</span>
            {/if}
            <button
              type="button"
              class="btn btn-primary"
              disabled={!routeDirty || routeSaving}
              onclick={() => void saveRouteFromSetupTab()}
            >
              {routeSaving ? "Saving…" : "Save route"}
            </button>
          </div>
        </form>
      </section>

      <section class="section" aria-labelledby="guard-rails-pointer-heading">
        <h2 id="guard-rails-pointer-heading" class="section-title">Guard rails</h2>
        <p class="section-desc">
          On the <strong>Flow map</strong>, select a step → expand <strong>Guard rails</strong> → pick a guard rail,
          choose <strong>entire route</strong> or <strong>this step only</strong>, then <strong>Apply</strong>. Two short
          lists show bindings per scope. Author definitions in the guard rails library.
        </p>
        {#if effectiveRoutePolicyBindings.length > 0}
          <p class="muted" role="status">
            {effectiveRoutePolicyBindings.length} whole-route
            {effectiveRoutePolicyBindings.length === 1 ? "guard rail is" : "guard rails are"} bound (including unsaved
            changes; view or change on Flow map, then <strong>Apply to server</strong>).
          </p>
        {:else}
          <p class="muted" role="status">No whole-route guard rails attached yet.</p>
        {/if}
        <p class="route-setup-guard-actions">
          <button type="button" class="btn btn-primary" onclick={() => (workspaceTab = "flow")}>Open Flow map</button>
          <a class="btn btn-secondary" href={DASHBOARD_BASE + "/policies"}>Guard rails library</a>
        </p>
      </section>
    </div>
  {:else}
    <div id="route-panel-more" role="tabpanel" aria-labelledby="route-tab-more" tabindex="0" class="route-tab-panel">
      <section class="section">
        <h2 class="section-title">Logs</h2>
        <p class="section-desc">Request and trace logs for this route.</p>
        <a href={DASHBOARD_BASE + "/logs"} class="btn btn-secondary">Open Logs & Traces</a>
      </section>
    </div>
  {/if}

  </div>
{/if}

<style>
  .route-editor-shell {
    min-width: 0;
  }
  .route-page-header {
    margin-bottom: var(--space-4);
  }
  .route-page-top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3) var(--space-4);
    margin-bottom: var(--space-3);
  }
  .route-page-heading {
    min-width: 0;
    flex: 1 1 12rem;
  }
  .route-page-heading .route-breadcrumb {
    margin-bottom: var(--space-1);
  }
  .route-page-title {
    margin: var(--space-1) 0 0;
  }
  .route-page-heading .page-desc {
    margin: var(--space-2) 0 0;
    max-width: 42rem;
    font-size: var(--text-sm);
    line-height: 1.55;
    color: var(--rm-muted);
  }
  .route-setup-description {
    resize: vertical;
    min-height: 4.5rem;
    line-height: 1.45;
  }
  .form-hint {
    margin-top: var(--space-1);
    margin-bottom: 0;
  }
  .route-setup-panel {
    max-width: 52rem;
  }
  .route-setup-guard-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .route-setup-section-head {
    margin-bottom: var(--space-3);
  }
  .route-setup-save-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .route-setup-save-row--footer {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--rm-border);
  }
  .route-setup-unsaved {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .route-setup-route-section {
    margin-bottom: var(--space-6);
    padding-bottom: var(--space-5);
    border-bottom: 1px solid var(--rm-border);
  }
  .inspector-hint-link {
    display: inline;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--rm-sage);
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-align: left;
  }
  .inspector-hint-link:hover {
    color: var(--rm-text);
  }
  .route-breadcrumb {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    margin-bottom: var(--space-2);
  }
  .route-breadcrumb .back-link {
    margin-bottom: 0;
  }
  .route-breadcrumb-sep {
    color: var(--rm-dim);
    user-select: none;
  }
  .route-breadcrumb-current {
    color: var(--rm-muted);
    font-weight: 500;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sr-only {
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
  .route-workspace-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    padding: var(--space-1) 0 0;
    border-bottom: 1px solid var(--rm-border);
    margin-top: var(--space-2);
  }
  .route-tab {
    border: 1px solid transparent;
    border-bottom: none;
    background: transparent;
    color: var(--rm-muted);
    font-size: var(--text-sm);
    font-weight: 500;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius) var(--rm-radius) 0 0;
    cursor: pointer;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .route-tab:hover {
    color: var(--rm-text);
    background: color-mix(in oklab, var(--rm-sage) 6%, transparent);
  }
  .route-tab-active {
    color: var(--rm-text);
    background: var(--rm-surface-raised);
    border-color: var(--rm-border);
    border-bottom-color: var(--rm-surface-raised);
    margin-bottom: -1px;
    padding-bottom: calc(var(--space-2) + 1px);
  }
  .route-tab-badge {
    font-size: var(--text-xs);
    font-weight: 600;
    background: color-mix(in oklab, var(--rm-sage) 18%, transparent);
    color: var(--rm-sage);
    border-radius: 999px;
    padding: 0 0.4rem;
    min-width: 1.25rem;
    text-align: center;
  }
  .route-tab-panel {
    padding-top: var(--space-4);
    outline: none;
  }
  .route-flow-shell {
    position: relative;
    min-width: 0;
  }
  .route-flow-draft-status {
    margin: 0 0 var(--space-4);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    font-size: var(--text-sm);
    line-height: 1.45;
  }
  .route-flow-draft-status--pending {
    border-color: color-mix(in oklab, var(--amber-insight) 55%, var(--rm-border));
    background: color-mix(in oklab, var(--amber-insight) 10%, var(--rm-surface));
    color: color-mix(in oklab, var(--amber-insight) 88%, var(--rm-text));
  }
  .route-flow-draft-status--pending .route-flow-draft-status-msg strong {
    color: var(--amber-insight);
  }
  .route-flow-draft-status--synced {
    border-color: color-mix(in oklab, var(--rm-sage) 45%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-sage) 8%, var(--rm-surface));
    color: var(--rm-muted);
  }
  .route-flow-draft-status--synced .route-flow-draft-status-msg strong {
    color: var(--rm-sage);
  }
  .route-flow-draft-status-msg {
    margin: 0;
  }
  .route-flow-draft-status-msg strong {
    font-weight: 600;
  }
  .route-flow-draft-status-time {
    font-weight: 500;
    color: var(--rm-text);
  }
  .route-flow-canvas-row {
    display: flex;
    flex-direction: row;
    /* Do not stretch the flow column to the inspector height — avoids huge vertical gaps in the map. */
    align-items: flex-start;
    gap: var(--space-4);
    width: 100%;
    min-height: 0;
  }
  @media (max-width: 960px) {
    .route-flow-canvas-row {
      flex-direction: column;
    }
  }
  .route-flow-main {
    flex: 1 1 0;
    min-width: 0;
  }
  .flow-editor-panel {
    margin-bottom: var(--space-3);
  }
  .route-visual-panel {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    /* With inspector + app nav open, three parallel cards can exceed width — scroll instead of painting under the drawer. */
    overflow-x: auto;
    overflow-y: visible;
    overscroll-behavior-x: contain;
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background-color: color-mix(in oklab, var(--rm-surface) 92%, var(--rm-bg));
    background-image:
      linear-gradient(color-mix(in oklab, var(--rm-border) 22%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in oklab, var(--rm-border) 22%, transparent) 1px, transparent 1px);
    background-size: 24px 24px;
    background-position: -1px -1px;
    padding: var(--space-2);
  }
  .route-inspector-guard-shell {
    padding: 0 0 var(--space-4);
    margin-bottom: var(--space-4);
    border-bottom: 1px solid var(--rm-border);
  }
  .route-inspector-panel {
    flex: 0 0 min(26rem, 40%);
    max-width: min(28rem, 100%);
    min-width: min(20rem, 100%);
    padding: 0;
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    display: flex;
    flex-direction: column;
    /* Height follows content; use browser scroll, not a nested scroll region */
    max-height: none;
    overflow: visible;
    align-self: flex-start;
  }
  @media (max-width: 960px) {
    .route-inspector-panel {
      flex: 1 1 auto;
      max-width: 100%;
      min-width: 0;
    }
  }
  .drawer-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--rm-border);
    flex-shrink: 0;
    background: var(--rm-surface-raised);
  }
  .drawer-toolbar-start {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    flex: 1 1 auto;
    min-width: 0;
  }
  .drawer-step-header-block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }
  .drawer-step-title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    width: 100%;
  }
  .drawer-step-desc {
    margin: 0;
    max-width: 28rem;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: var(--rm-dim);
  }
  .drawer-step-label-limit {
    margin: var(--space-1) 0 0;
    max-width: 28rem;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.35;
  }
  .drawer-step-rename-link {
    flex-shrink: 0;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--rm-sage);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .drawer-step-rename-link:hover {
    color: var(--rm-text);
  }
  .drawer-step-rename-link:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
    border-radius: 2px;
  }
  .drawer-step-label-input {
    flex: 1 1 10rem;
    min-width: 0;
    font-size: var(--text-base);
    font-weight: 600;
    padding: 0.35rem 0.5rem;
  }
  .drawer-toolbar-end {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .drawer-step-title {
    margin: 0;
    padding: 0;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    min-width: 0;
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  .drawer-body {
    flex: 0 0 auto;
    overflow: visible;
    padding: var(--space-4);
  }
  .drawer-inline-error {
    margin-top: 0;
  }
  .inspector-lede {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    line-height: 1.45;
    color: var(--rm-muted);
  }
  .inspector-lede--tight {
    margin-bottom: var(--space-2);
  }
  .inspector-lede--runtime-hint {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    line-height: 1.45;
    color: var(--rm-muted);
  }
  /** Same visual weight as `.form-row label` (Provider, Model, …). */
  .inspector-subsection-label {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-text);
  }
  .inspector-runtime-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }
  .inspector-runtime-fields .form-row.compact {
    margin-bottom: 0;
    min-width: 0;
    flex: 0 0 auto;
    width: 100%;
  }
  .inspector-runtime-fields .form-row.compact.full-width {
    min-width: 0;
  }
  .inspector-disclosure-intro {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    line-height: 1.45;
    color: var(--rm-muted);
  }
  .inspector-disclosures-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: 100%;
    margin-top: 0;
  }
  .inspector-disclosure {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    margin-top: 0;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: 0 var(--space-3);
    background: color-mix(in oklab, var(--rm-border) 6%, transparent);
  }
  .inspector-disclosure-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    width: 100%;
    box-sizing: border-box;
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
    padding: var(--space-3) 0;
    list-style: none;
  }
  .inspector-disclosure-summary::-webkit-details-marker {
    display: none;
  }
  .inspector-disclosure-summary::after {
    content: "▸";
    flex-shrink: 0;
    color: var(--rm-muted);
    font-size: var(--text-xs);
  }
  .inspector-disclosure[open] > .inspector-disclosure-summary::after {
    content: "▾";
  }
  .inspector-disclosure-body {
    padding-bottom: var(--space-3);
  }
  .inspector-disclosure-body .form-row:last-child {
    margin-bottom: 0;
  }
  .config-form > .inspector-disclosure {
    margin-top: var(--space-3);
  }
  .drawer-inspector-empty-toolbar {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .drawer-inspector-empty-lede {
    margin: 0;
    max-width: 28rem;
    line-height: 1.45;
  }
  .inspector-switch-guard {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--rm-border);
    background: color-mix(in oklab, var(--amber-insight) 10%, var(--rm-surface-raised));
  }
  .inspector-switch-guard-msg {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--rm-text);
  }
  .inspector-switch-guard-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .inspector-empty-panel-lede {
    margin: 0;
    max-width: 28rem;
    line-height: 1.5;
  }
  .route-flow-step-error {
    margin: 0 0 var(--space-3);
  }
  .add-step-dialog {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: 0;
    max-width: min(100vw - 1.5rem, 34rem);
    width: calc(100vw - 1.5rem);
    max-height: min(90dvh, 26rem);
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }
  .add-step-dialog::backdrop {
    background: rgba(0, 0, 0, 0.45);
  }
  .add-step-dialog-form {
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: min(90dvh, 26rem);
    height: 100%;
  }
  .add-step-dialog-header {
    flex-shrink: 0;
    padding: var(--space-4) var(--space-4) var(--space-2);
    border-bottom: 1px solid var(--rm-border);
  }
  .add-step-dialog-title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--rm-text);
  }
  .add-step-dialog-lede {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: color-mix(in oklab, var(--rm-text) 55%, var(--rm-muted));
  }
  .add-step-dialog-fields {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4);
    -webkit-overflow-scrolling: touch;
  }
  .add-step-dialog-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3) var(--space-4);
    align-items: start;
  }
  @media (max-width: 28rem) {
    .add-step-dialog-grid {
      grid-template-columns: 1fr;
    }
  }
  .add-step-dialog-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .add-step-dialog-field label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--rm-text);
    letter-spacing: 0.02em;
  }
  .add-step-dialog-input {
    width: 100%;
    min-height: 2.5rem;
    box-sizing: border-box;
  }
  .add-step-dialog-actions {
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    margin-top: auto;
  }
  .inspector-section {
    margin-bottom: var(--space-5);
  }
  .inspector-section:last-child {
    margin-bottom: 0;
  }
  .inspector-hint {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0;
  }
  .back-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    margin-bottom: var(--space-4);
    display: inline-block;
  }
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .publish-draft-banner {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: 1px solid color-mix(in oklab, var(--coral-alert) 40%, var(--rm-border));
    background: color-mix(in oklab, var(--coral-alert) 8%, var(--rm-surface));
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .section {
    margin-bottom: var(--space-6);
  }
  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-1);
  }
  .section-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }
  .danger-zone {
    border: 1px solid color-mix(in oklab, var(--coral-alert) 35%, var(--rm-border));
    border-radius: var(--rm-radius);
    padding: var(--space-4);
    background: color-mix(in oklab, var(--coral-alert) 6%, var(--rm-surface));
  }
  .config-form {
    max-width: 28rem;
  }
  .form-row {
    margin-bottom: var(--space-3);
  }
  .form-row.compact {
    margin-bottom: 0;
    min-width: 12rem;
    flex: 1 1 12rem;
  }
  .form-row.compact.full-width {
    flex: 1 1 100%;
    min-width: 100%;
  }
  .textarea-json {
    min-height: 5rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: var(--text-xs);
  }
  .form-row label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 500;
    margin-bottom: var(--space-1);
  }
  .input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .btn-danger {
    background: transparent;
    color: var(--coral-alert);
    border: 1px solid var(--coral-alert);
  }
  .btn-inline {
    padding: 4px 10px;
    font-size: var(--text-xs);
  }
  .inline-form {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .step-panel-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin-bottom: var(--space-2);
  }
  .step-panel-actions-btn {
    min-width: 6.75rem;
    touch-action: manipulation;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease,
      box-shadow 0.1s ease,
      transform 0.06s ease;
  }
  .step-panel-actions-btn:hover:not(:disabled) {
    background: var(--rm-surface-raised);
    border-color: color-mix(in oklab, var(--rm-text) 18%, var(--rm-border));
  }
  .step-panel-actions-btn:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: inset 0 1px 2px color-mix(in oklab, var(--rm-text) 12%, transparent);
  }
  .step-panel-actions-btn:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }
  .step-panel-actions-btn:disabled {
    cursor: wait;
    opacity: 0.72;
  }
  .route-inspector-advanced-guard {
    margin-top: 0;
  }
  .inspector-step-actions-footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--rm-border);
    align-items: stretch;
  }
  .inspector-section-apply {
    margin-top: var(--space-4);
    display: flex;
    justify-content: flex-start;
  }
  .inspector-section-apply-btn {
    min-width: 10rem;
  }
  .inspector-remove-confirm-msg {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--rm-text);
  }
  .inspector-remove-confirm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .inspector-step-remove-btn {
    width: 100%;
    touch-action: manipulation;
    transition:
      background-color 0.12s ease,
      color 0.12s ease,
      border-color 0.12s ease,
      box-shadow 0.1s ease,
      transform 0.06s ease;
  }
  .inspector-step-remove-btn:hover:not(:disabled) {
    background: color-mix(in oklab, var(--coral-alert) 12%, transparent);
  }
  .inspector-step-remove-btn:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: inset 0 1px 2px color-mix(in oklab, var(--coral-alert) 18%, transparent);
  }
  .inspector-step-remove-btn:focus-visible {
    outline: 2px solid var(--coral-alert);
    outline-offset: 2px;
  }
  .inspector-step-remove-btn:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
  .inspector-remove-confirm-actions .btn {
    touch-action: manipulation;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease,
      transform 0.06s ease;
  }
  .inspector-remove-confirm-actions .btn:hover:not(:disabled) {
    filter: brightness(1.05);
  }
  .inspector-remove-confirm-actions .btn:active:not(:disabled) {
    transform: translateY(1px);
  }
  .inspector-remove-confirm-actions .btn:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }
  .inline-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    border-radius: 4px;
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
  }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin-top: var(--space-2);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
  .lifecycle-warning {
    background: var(--rm-surface-raised);
    border: 1px solid var(--coral-alert);
    border-radius: var(--rm-radius);
    padding: var(--space-3);
    margin-bottom: var(--space-4);
    font-size: var(--text-sm);
  }
  .lifecycle-warning ul {
    margin: var(--space-2) 0 0;
    padding-left: var(--space-5);
  }
  .lifecycle-warning li {
    margin-bottom: var(--space-1);
  }
  .lifecycle-state {
    color: var(--rm-muted);
  }
</style>
