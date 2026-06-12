<script lang="ts">
  import { tick } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { buildRouteFlowSegments, type RouteFlowSegment } from "$lib/route-flow-segments";
  import { invalidateAll } from "$app/navigation";

  /** Marketing / embedded preview — hides toolbar and add controls; cards are non-interactive. */
  export let preview = false;

  export let projectId: string;
  export let routeId: string;
  export let steps: {
    id: string;
    orderIndex: number;
    label?: string | null;
    modelId: string | null;
    providerPreference: string | null;
    enabled: boolean;
    parallelGroupId?: string | null;
    parallelBranchRole?: string | null;
  }[];
  /** Saved next-step relationships (control plane); API still uses `edges` in JSON. */
  export let stepLinks: {
    id: string;
    fromStepId: string;
    toStepId: string;
    priority: number;
    label?: string | null;
  }[];
  export let flowLayout: Record<string, unknown> | null;
  export let entryStepId: string | null;
  /** Parent opens / updates the route inspector. Return `false` to keep the current selection (e.g. unsaved edits). */
  export let onStepSelected: ((stepId: string) => boolean | void) | undefined = undefined;
  /** True when local map draft (edges / layout snapshot) differs from server — for leave guards + toolbar state. */
  export let onMapDraftDirty: ((dirty: boolean) => void) | undefined = undefined;
  /** Step rows committed locally for the map but not yet PATCHed to the server (parent-owned overlay). */
  export let inspectorPendingServerPatch = false;
  /** Parent sets true while step PATCH batch runs from “Apply to server”. */
  export let inspectorSaving = false;
  /** PATCH all locally committed steps, then parent refreshes; runs before graph PUT when both are dirty. */
  export let onCommitInspectorDraft: (() => Promise<boolean>) | undefined = undefined;
  /** Parent: reset inspector + step overlays when discarding drafts (used by `revertRouteDraft`, leave navigation). */
  export let onRevertInspectorDraft: (() => void) | undefined = undefined;
  /** Fired when the toolbar starts/finishes a network apply (map and/or inspector) so parents can disable other actions. */
  export let onToolbarBusyChange: ((busy: boolean) => void) | undefined = undefined;
  /** After a successful **Apply to server** (steps PATCH and/or graph PUT). */
  export let onFlowAppliedToServer: (() => void) | undefined = undefined;
  /** Selection highlight for step cards (matches parent inspector step; parent blocks updates until save/discard). */
  export let selectedInspectorStepId: string | null = null;
  /** Add a parallel branch: for a linear step, starts a parallel group + second branch; for grouped steps, adds another member. */
  export let onAddParallelBranch: ((stepId: string) => void | Promise<void>) | undefined = undefined;
  export let addParallelBusy = false;
  /** Opens the shared “Add step” dialog: insert after this anchor (next segment), or first step when `null` (empty route). */
  export let onRequestAddLinearStep: ((anchorStepId: string | null) => void) | undefined = undefined;

  /** Vertical layout hint for saved flowLayout (compact cards). */
  const CARD_MIN_H = 44;
  const GAP = 8;
  const MAX_PARALLEL_BRANCHES = 3;

  type DraftEdge = {
    fromStepId: string;
    toStepId: string;
    priority: number;
    label: string | null;
  };

  type StepT = (typeof steps)[number];

  let draftStepLinks: DraftEdge[] = [];
  let saving = false;
  let saveError = "";

  $: orderedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);

  $: segments = buildRouteFlowSegments(orderedSteps) as RouteFlowSegment<StepT>[];

  function anchorStepId(seg: RouteFlowSegment<StepT>): string {
    if (seg.type === "linear") return seg.steps[0].id;
    return seg.steps[seg.steps.length - 1].id;
  }

  function anchorLabel(seg: RouteFlowSegment<StepT>): string {
    if (seg.type === "linear") return stepShortLabel(seg.steps[0]);
    return `parallel group ${seg.groupId} (after ${stepShortLabel(seg.steps[seg.steps.length - 1])})`;
  }

  let layoutSig = "";
  $: {
    const sig = `${routeId}|${JSON.stringify(flowLayout ?? {})}|${stepLinks.map((e) => e.id).join(",")}|${orderedSteps.map((s) => s.id).join(",")}`;
    if (sig !== layoutSig) {
      layoutSig = sig;
      draftStepLinks = stepLinks.map((e) => ({
        fromStepId: e.fromStepId,
        toStepId: e.toStepId,
        priority: e.priority,
        label: e.label ?? null,
      }));
    }
  }

  function stepShortLabel(step: StepT): string {
    return `Step ${step.orderIndex + 1} · ${step.modelId ?? "(no model)"}`;
  }

  /** JSON.stringify order for objects is insertion-dependent; DB JSON can reorder keys. */
  function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map(stableStringify).join(",")}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }

  /** Compare only the fields we PUT for flow layout so extra stored keys do not keep the map “dirty”. */
  function comparableFlowLayout(layout: Record<string, unknown>): Record<string, unknown> {
    const nodes = layout.nodes;
    return {
      version: layout.version,
      layout: layout.layout,
      nodes:
        nodes && typeof nodes === "object" && !Array.isArray(nodes) ? (nodes as Record<string, unknown>) : {},
    };
  }

  function normalizeEdges(
    edges: { fromStepId: string; toStepId: string; priority: number; label: string | null }[]
  ) {
    return [...edges]
      .map((e) => ({
        fromStepId: e.fromStepId,
        toStepId: e.toStepId,
        priority: e.priority,
        label: e.label ?? null,
      }))
      .sort((a, b) => {
        const c = a.fromStepId.localeCompare(b.fromStepId);
        if (c) return c;
        const d = a.toStepId.localeCompare(b.toStepId);
        if (d) return d;
        return a.priority - b.priority;
      });
  }

  function buildFlowLayoutPayload(steps: StepT[]) {
    return {
      version: 2,
      layout: "vertical",
      nodes: Object.fromEntries(
        steps.map((s, i) => [
          s.id,
          { x: 0, y: i * (CARD_MIN_H + GAP), w: "100%", h: CARD_MIN_H },
        ])
      ),
    };
  }

  /**
   * Routes often have `flowLayout` null until the first graph PUT. Comparing the client payload to
   * raw `null` would keep the map "dirty" forever — treat null/empty
   * server layout as the canonical vertical snapshot for this step list.
   */
  function flowLayoutBaselineForDirtyCheck(
    server: Record<string, unknown> | null | undefined,
    steps: StepT[]
  ): Record<string, unknown> {
    if (server == null) return buildFlowLayoutPayload(steps);
    if (typeof server !== "object" || Array.isArray(server)) return buildFlowLayoutPayload(steps);
    if (Object.keys(server).length === 0) return buildFlowLayoutPayload(steps);
    return server;
  }

  $: serverEdgesNorm = normalizeEdges(
    stepLinks.map((e) => ({
      fromStepId: e.fromStepId,
      toStepId: e.toStepId,
      priority: e.priority,
      label: e.label ?? null,
    }))
  );
  $: draftEdgesNorm = normalizeEdges(draftStepLinks);
  $: flowLayoutPayload = buildFlowLayoutPayload(orderedSteps);
  $: serverFlowLayoutBaseline = flowLayoutBaselineForDirtyCheck(flowLayout, orderedSteps);
  $: mapDraftDirty =
    orderedSteps.length > 0 &&
    (stableStringify(draftEdgesNorm) !== stableStringify(serverEdgesNorm) ||
      stableStringify(comparableFlowLayout(flowLayoutPayload as Record<string, unknown>)) !==
        stableStringify(comparableFlowLayout(serverFlowLayoutBaseline as Record<string, unknown>)));
  $: serverApplyDirty = mapDraftDirty || inspectorPendingServerPatch;
  $: onMapDraftDirty?.(mapDraftDirty);

  function trimStepLabel(step: StepT): string {
    return (step.label ?? "").trim();
  }

  function segmentKey(seg: RouteFlowSegment<StepT>): string {
    return seg.type === "linear" ? `l-${seg.steps[0].id}` : `p-${seg.groupId}`;
  }

  /** First segment in the vertical chain is primary; later segments are fallbacks (same rule for linear and parallel). */
  function chainRoleLabel(segmentIndex: number): string {
    return segmentIndex === 0 ? "primary" : "fallback";
  }

  function onCardClick(stepId: string) {
    const r = onStepSelected?.(stepId);
    if (r === false) return;
  }

  function revertRouteMapDraft() {
    draftStepLinks = stepLinks.map((e) => ({
      fromStepId: e.fromStepId,
      toStepId: e.toStepId,
      priority: e.priority,
      label: e.label ?? null,
    }));
    saveError = "";
  }

  /** Persist locally committed steps (PATCH) then graph PUT + invalidate when the map draft is dirty. */
  export async function applyRouteDraft(): Promise<boolean> {
    if (!projectId || !routeId) return false;
    const applyMap = mapDraftDirty;
    const applySteps = inspectorPendingServerPatch;
    if (!applyMap && !applySteps) return true;

    saving = true;
    onToolbarBusyChange?.(true);
    saveError = "";
    try {
      if (applySteps && onCommitInspectorDraft) {
        const ok = await onCommitInspectorDraft();
        if (!ok) return false;
      }
      if (applyMap) {
        const res = await fetch(
          `${DASHBOARD_BASE}/api/projects/${projectId}/routes/${routeId}/graph`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              edges: draftStepLinks.map((e) => ({
                fromStepId: e.fromStepId,
                toStepId: e.toStepId,
                priority: e.priority,
                label: e.label,
              })),
              entryStepId: entryStepId ?? null,
              flowLayout: flowLayoutPayload,
            }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          saveError = (body as { error?: string }).error ?? `Apply failed (${res.status})`;
          return false;
        }
        await invalidateAll();
        /** Let parent props (edges, flowLayout) flush before syncing draft edges from server. */
        await tick();
        await tick();
        revertRouteMapDraft();
      }
      if (applyMap || applySteps) {
        onFlowAppliedToServer?.();
      }
      return true;
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Apply failed";
      return false;
    } finally {
      saving = false;
      onToolbarBusyChange?.(false);
    }
  }

  /** Discard local map draft and inspector draft together. */
  export function revertRouteDraft(): void {
    revertRouteMapDraft();
    onRevertInspectorDraft?.();
  }

  function onPlusClick(ev: MouseEvent, anchorId: string) {
    ev.stopPropagation();
    onRequestAddLinearStep?.(anchorId);
  }

  const TOOLTIP_ADD_NEXT_STEP =
    "Add next model — inserts another model after this one in the fallback chain.";
  const TOOLTIP_ADD_PARALLEL =
    "Add parallel model — adds another model that runs alongside this step (same parallel group).";
  const TOOLTIP_MAX_PARALLEL = "This parallel group allows at most three models.";

  const MAP_ZOOM_MIN = 0.6;
  const MAP_ZOOM_MAX = 1.4;
  const MAP_ZOOM_STEP = 0.1;
  let mapZoom = 1;

  function clampMapZoom(z: number): number {
    return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, Math.round(z * 10) / 10));
  }

  function mapZoomIn() {
    mapZoom = clampMapZoom(mapZoom + MAP_ZOOM_STEP);
  }
  function mapZoomOut() {
    mapZoom = clampMapZoom(mapZoom - MAP_ZOOM_STEP);
  }
  function mapZoomReset() {
    mapZoom = 1;
  }

  /** Ctrl/Cmd + wheel zoom inside the framed map (non-passive so the browser does not capture zoom). */
  function mapViewportWheelZoom(node: HTMLElement) {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      mapZoom = clampMapZoom(mapZoom + (e.deltaY < 0 ? MAP_ZOOM_STEP : -MAP_ZOOM_STEP));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return {
      destroy() {
        node.removeEventListener("wheel", onWheel);
      },
    };
  }
</script>

<div
  class="route-map-root"
  class:route-map-root--preview={preview}
  aria-label="Route map: provider steps and next-step order"
>
  {#if !preview && saveError}
    <p class="error-msg" role="alert">{saveError}</p>
  {/if}

  {#if orderedSteps.length === 0}
    <div class="route-map-empty" role="status">
      <p class="route-map-empty-p">No models yet. Add one from the map, then <strong>Apply to server</strong> when ready.</p>
      {#if onRequestAddLinearStep}
        <button type="button" class="btn btn-primary route-map-empty-btn" onclick={() => onRequestAddLinearStep?.(null)}>
          Add first model…
        </button>
      {/if}
    </div>
  {:else}
  {#if !preview}
  <div class="route-map-toolbar" role="toolbar" aria-label="Route map actions">
    <div class="route-map-toolbar-row">
      <p class="route-map-toolbar-lede">
        In the inspector, <strong>Apply changes</strong> merges model edits into a <strong>local draft</strong> (the map updates in the browser only).
        <strong>Apply to server</strong> writes that draft to the API. If you navigate away without saving, you’ll be asked to discard unsaved work.
      </p>
      <div class="route-map-toolbar-actions">
        <button
          type="button"
          class="btn btn-primary route-map-toolbar-save"
          onclick={() => void applyRouteDraft()}
          disabled={saving || inspectorSaving || !serverApplyDirty}
          title={serverApplyDirty ? "Persist map draft and locally merged models to the server" : "Nothing pending for the server"}
        >
          {saving || inspectorSaving ? "Applying…" : "Apply to server"}
        </button>
      </div>
    </div>
    <div class="route-map-zoom-strip">
      <div class="route-map-zoom-bar" role="group" aria-label="Flow map zoom">
        <button
          type="button"
          class="btn btn-secondary btn-inline route-map-zoom-btn"
          onclick={() => mapZoomOut()}
          disabled={mapZoom <= MAP_ZOOM_MIN}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <span class="route-map-zoom-pct" aria-live="polite">{Math.round(mapZoom * 100)}%</span>
        <button
          type="button"
          class="btn btn-secondary btn-inline route-map-zoom-btn"
          onclick={() => mapZoomIn()}
          disabled={mapZoom >= MAP_ZOOM_MAX}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-inline route-map-zoom-btn route-map-zoom-btn--text"
          onclick={() => mapZoomReset()}
          title="Reset zoom to 100%"
          aria-label="Reset zoom to 100 percent"
        >
          Reset
        </button>
      </div>
      <p class="route-map-zoom-hint" id="route-map-zoom-hint">
        <kbd class="route-map-kbd">Ctrl</kbd>/<kbd class="route-map-kbd">⌘</kbd>+scroll in frame
      </p>
    </div>
  </div>
  {/if}
  <div class="route-map-viewport-shell" use:mapViewportWheelZoom aria-describedby={preview ? undefined : "route-map-zoom-hint"}>
    <div class="route-map-viewport">
      <div class="route-map-scale-inner" style:transform="scale({mapZoom})" style:transform-origin="top center">
        <div class="route-map-column" role="list">
    {#each segments as seg, segmentIndex (segmentKey(seg))}
      {@const aid = anchorStepId(seg)}
      {@const hasChainBelow = segmentIndex < segments.length - 1}
      <div class="route-map-segment">
        {#if seg.type === "linear"}
          {@const s = seg.steps[0]}
          {@const roleLabel = chainRoleLabel(segmentIndex)}
          <div class="route-map-step-block">
            <div
              class="route-map-step-main"
              class:route-map-step-main--no-side={!onAddParallelBranch}
            >
              <div class="route-map-cards-strip">
                <div class="route-map-node-shell">
                  <button
                    type="button"
                    class="route-map-card"
                    class:route-map-card-off={!s.enabled}
                    class:route-map-card-sel={selectedInspectorStepId === s.id}
                    aria-current={selectedInspectorStepId === s.id ? "true" : undefined}
                    onclick={() => onCardClick(s.id)}
                  >
                    <span class="route-map-card-tags" aria-hidden="true">
                      <span
                        class="route-map-card-tag route-map-card-tag--status"
                        class:route-map-card-tag--status-on={s.enabled}
                        class:route-map-card-tag--status-off={!s.enabled}
                      >
                        {s.enabled ? "enabled" : "disabled"}
                      </span>
                      <span class="route-map-card-tag route-map-card-tag--kind">{roleLabel}</span>
                    </span>
                    <span class="sr-only">
                      {s.enabled ? "Enabled." : "Disabled."}
                      {roleLabel === "primary" ? "Primary" : "Fallback"} in the route chain (one model).
                    </span>
                    {#if trimStepLabel(s)}
                      <span class="route-map-node-title">{trimStepLabel(s)}</span>
                      <span class="route-map-node-idx route-map-node-idx--sub">Step {s.orderIndex + 1}</span>
                    {:else}
                      <span class="route-map-node-idx">Step {s.orderIndex + 1}</span>
                    {/if}
                    <span class="route-map-node-model">{s.modelId ?? "—"}</span>
                    <span class="route-map-node-meta">{s.providerPreference ?? "provider"}</span>
                  </button>
                </div>
              </div>
              {#if onAddParallelBranch}
                <button
                  type="button"
                  class="route-map-plus route-map-plus-side"
                  title={TOOLTIP_ADD_PARALLEL}
                  aria-label={TOOLTIP_ADD_PARALLEL}
                  disabled={addParallelBusy}
                  aria-busy={addParallelBusy ? "true" : undefined}
                  onclick={(e) => {
                    e.stopPropagation();
                    void onAddParallelBranch(s.id);
                  }}
                >
                  +
                </button>
              {/if}
              {#if onRequestAddLinearStep}
                <div class="route-map-add-slot">
                  {#if hasChainBelow}
                    <div class="route-map-chain-connector">
                      <span class="route-map-chain-spine" aria-hidden="true"></span>
                      <button
                        type="button"
                        class="route-map-plus route-map-plus-chain route-map-plus-on-spine"
                        title={TOOLTIP_ADD_NEXT_STEP}
                        aria-label="Add next model in the fallback chain"
                        onclick={(ev) => onPlusClick(ev, aid)}
                      >
                        +
                      </button>
                      <span class="route-map-chain-arrow" aria-hidden="true">▼</span>
                    </div>
                  {:else}
                    <div class="route-map-add-slot-plain">
                      <button
                        type="button"
                        class="route-map-plus route-map-plus-chain"
                        title={TOOLTIP_ADD_NEXT_STEP}
                        aria-label="Add next model in the fallback chain"
                        onclick={(ev) => onPlusClick(ev, aid)}
                      >
                        +
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {:else}
          {@const parallelFull = seg.steps.length >= MAX_PARALLEL_BRANCHES}
          {@const lastBranchId = seg.steps[seg.steps.length - 1]?.id ?? ""}
          {@const roleLabel = chainRoleLabel(segmentIndex)}
          <div class="route-map-step-block route-map-step-block--parallel">
            <div
              class="route-map-step-main route-map-step-main--parallel"
              class:route-map-step-main--no-side={!onAddParallelBranch || !lastBranchId}
            >
              <div class="route-map-cards-strip">
                <div
                  class="route-map-parallel-frame"
                  role="group"
                  aria-label="Parallel models, group {seg.groupId}"
                >
                  <div class="route-map-parallel-inner">
                    {#each seg.steps as s, si (s.id)}
                      {#if si > 0}
                        <span class="route-map-parallel-link" aria-hidden="true"></span>
                      {/if}
                      <div class="route-map-node-shell route-map-parallel-branch">
                        <button
                          type="button"
                          class="route-map-card"
                          class:route-map-card-off={!s.enabled}
                          class:route-map-card-sel={selectedInspectorStepId === s.id}
                          aria-current={selectedInspectorStepId === s.id ? "true" : undefined}
                          onclick={() => onCardClick(s.id)}
                        >
                          <span class="route-map-card-tags" aria-hidden="true">
                            <span
                              class="route-map-card-tag route-map-card-tag--status"
                              class:route-map-card-tag--status-on={s.enabled}
                              class:route-map-card-tag--status-off={!s.enabled}
                            >
                              {s.enabled ? "enabled" : "disabled"}
                            </span>
                            <span class="route-map-card-tag route-map-card-tag--kind">{roleLabel}</span>
                          </span>
                          <span class="sr-only">
                            {s.enabled ? "Enabled." : "Disabled."}
                            {roleLabel === "primary" ? "Primary" : "Fallback"} in the route chain (parallel group; branches
                            run concurrently).
                          </span>
                          {#if trimStepLabel(s)}
                            <span class="route-map-node-title">{trimStepLabel(s)}</span>
                            <span class="route-map-node-idx route-map-node-idx--sub">Step {s.orderIndex + 1}</span>
                          {:else}
                            <span class="route-map-node-idx">Step {s.orderIndex + 1}</span>
                          {/if}
                          <span class="route-map-node-model">{s.modelId ?? "—"}</span>
                          <span class="route-map-node-meta">{s.providerPreference ?? "provider"}</span>
                        </button>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
              {#if onAddParallelBranch && lastBranchId}
                <button
                  type="button"
                  class="route-map-plus route-map-plus-side"
                  title={parallelFull ? TOOLTIP_MAX_PARALLEL : TOOLTIP_ADD_PARALLEL}
                  aria-label={parallelFull ? TOOLTIP_MAX_PARALLEL : TOOLTIP_ADD_PARALLEL}
                  disabled={addParallelBusy || parallelFull}
                  aria-busy={addParallelBusy ? "true" : undefined}
                  onclick={(e) => {
                    e.stopPropagation();
                    void onAddParallelBranch(lastBranchId);
                  }}
                >
                  +
                </button>
              {/if}
              {#if onRequestAddLinearStep}
                <div class="route-map-add-slot">
                  {#if hasChainBelow}
                    <div class="route-map-chain-connector">
                      <span class="route-map-chain-spine" aria-hidden="true"></span>
                      <button
                        type="button"
                        class="route-map-plus route-map-plus-chain route-map-plus-on-spine"
                        title={TOOLTIP_ADD_NEXT_STEP}
                        aria-label="Add next model in the fallback chain"
                        onclick={(ev) => onPlusClick(ev, aid)}
                      >
                        +
                      </button>
                      <span class="route-map-chain-arrow" aria-hidden="true">▼</span>
                    </div>
                  {:else}
                    <div class="route-map-add-slot-plain">
                      <button
                        type="button"
                        class="route-map-plus route-map-plus-chain"
                        title={TOOLTIP_ADD_NEXT_STEP}
                        aria-label="Add next model in the fallback chain"
                        onclick={(ev) => onPlusClick(ev, aid)}
                      >
                        +
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}
        </div>
      </div>
    </div>
  </div>
  {/if}
</div>

<style>
  .route-map-root {
    margin-bottom: var(--space-3);
    min-width: 0;
    max-width: 100%;
    /* Shared compact card size: linear + parallel (max three branches side by side) */
    --route-map-card-w: 10rem;
    --route-map-card-h: 5.25rem;
    --route-map-plus-side-size: 1.625rem;
    --route-map-inline-gap: 0.25rem;
    --route-map-shell-w: calc(var(--route-map-card-w) + 4px);
    --route-map-parallel-max-branches: 3;
    --route-map-segment-gap: var(--space-1);
  }
  .route-map-root--preview {
    margin-bottom: 0;
    pointer-events: none;
  }
  .route-map-root--preview .route-map-card {
    cursor: default;
  }
  .route-map-toolbar {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    width: 100%;
    max-width: min(100%, 56rem);
    margin: 0 auto var(--space-2);
    padding: var(--space-2) var(--space-1) var(--space-2);
    box-sizing: border-box;
    /* Match `.route-visual-panel` so the sticky strip blends with the canvas panel */
    background: color-mix(in oklab, var(--rm-surface) 92%, var(--rm-bg));
    border-bottom: 1px solid color-mix(in oklab, var(--rm-border) 55%, transparent);
    box-shadow: 0 6px 12px -8px color-mix(in oklab, var(--rm-text) 18%, transparent);
  }
  .route-map-toolbar-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    width: 100%;
  }
  .route-map-toolbar-lede {
    flex: 1 1 14rem;
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--rm-muted);
    text-align: left;
  }
  .route-map-toolbar-actions {
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
    justify-content: flex-start;
    flex-shrink: 0;
    min-width: min(100%, 10.5rem);
  }
  /** Zoom sits below the lede, directly above the framed graph. */
  .route-map-zoom-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-1) var(--space-3);
    width: 100%;
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid color-mix(in oklab, var(--rm-border) 38%, transparent);
  }
  .route-map-zoom-bar {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-start;
    gap: 0.2rem;
  }
  .route-map-zoom-btn {
    min-width: 1.5rem;
    padding: 0.1rem 0.32rem;
    font-size: 0.7rem;
    line-height: 1.15;
    border-radius: var(--radius-sm, 4px);
  }
  .route-map-zoom-btn--text {
    min-width: auto;
    padding-inline: 0.35rem;
    font-size: 0.65rem;
    font-weight: 500;
  }
  .route-map-zoom-pct {
    min-width: 2.35rem;
    text-align: center;
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
    color: var(--rm-muted);
  }
  .route-map-zoom-hint {
    margin: 0;
    font-size: 0.62rem;
    line-height: 1.3;
    text-align: right;
    color: var(--rm-muted);
    flex: 1 1 8rem;
  }
  .route-map-kbd {
    display: inline-block;
    padding: 0.02rem 0.2rem;
    border-radius: 2px;
    border: 1px solid color-mix(in oklab, var(--rm-border) 80%, transparent);
    font-size: 0.58rem;
    font-family: ui-monospace, monospace;
    background: color-mix(in oklab, var(--rm-surface-raised) 70%, var(--rm-bg));
  }
  .route-map-toolbar-actions .btn {
    width: 100%;
    text-align: center;
    box-sizing: border-box;
  }
  .route-map-toolbar .route-map-toolbar-save {
    transition:
      background-color 0.12s ease,
      color 0.12s ease,
      filter 0.12s ease,
      box-shadow 0.1s ease,
      transform 0.06s ease;
  }
  .route-map-toolbar .route-map-toolbar-save:hover:not(:disabled) {
    filter: brightness(1.06);
  }
  .route-map-toolbar .route-map-toolbar-save:active:not(:disabled) {
    transform: translateY(1px);
    filter: brightness(0.96);
  }
  .route-map-toolbar .route-map-toolbar-save:focus-visible {
    outline: 2px solid color-mix(in oklab, var(--rm-bg) 65%, var(--rm-sage));
    outline-offset: 2px;
  }
  .route-map-toolbar .btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .route-map-empty {
    margin: 0 auto;
    padding: var(--space-3);
    max-width: 28rem;
    text-align: center;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.5;
    border: 1px dashed var(--rm-border);
    border-radius: var(--radius-md);
    background: color-mix(in oklab, var(--rm-border) 8%, transparent);
  }
  .route-map-empty-p {
    margin: 0 0 var(--space-3);
  }
  .route-map-empty-btn {
    margin: 0 auto;
  }
  .error-msg {
    color: var(--rm-danger, #b91c1c);
    margin: 0 0 var(--space-2);
  }
  .route-map-viewport-shell {
    width: 100%;
    max-width: min(100%, 56rem);
    margin: 0 auto;
    border: var(--border-thin);
    border-radius: var(--radius-lg);
    background: color-mix(in oklab, var(--rm-surface) 96%, var(--rm-bg));
    box-shadow: 0 1px 2px color-mix(in oklab, var(--rm-text) 5%, transparent);
    box-sizing: border-box;
    overflow: hidden;
  }
  .route-map-viewport {
    overflow: auto;
    max-height: min(70vh, 36rem);
    min-height: 10rem;
    padding: var(--space-2) var(--space-3);
    box-sizing: border-box;
    overscroll-behavior: contain;
  }
  .route-map-scale-inner {
    width: fit-content;
    min-width: min(100%, 100%);
    margin: 0 auto;
    will-change: transform;
  }
  .route-map-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
    padding: var(--space-1) 0;
    box-sizing: border-box;
  }
  .route-map-segment {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 100%;
  }
  .route-map-step-block {
    width: fit-content;
    max-width: 100%;
    align-self: center;
  }
  /**
   * Grid: row1 = cards strip + side +; row2 = chain + only in col1.
   * Centers the vertical “add next” control on the card column, not on strip+side width.
   */
  .route-map-step-main {
    display: grid;
    grid-template-columns: minmax(0, max-content) var(--route-map-plus-side-size);
    column-gap: var(--route-map-inline-gap);
    row-gap: 0.25rem;
    align-items: center;
    justify-items: center;
  }
  .route-map-step-main--no-side {
    grid-template-columns: minmax(0, max-content);
  }
  .route-map-step-main--parallel {
    column-gap: var(--space-2);
  }
  .route-map-cards-strip {
    grid-column: 1;
    grid-row: 1;
    justify-self: stretch;
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
  .route-map-step-main .route-map-plus-side {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
    justify-self: center;
  }
  /** One bordered box = step card only; + controls sit in `.route-map-node-row` outside this shell. */
  .route-map-node-shell {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 2px;
    box-sizing: border-box;
    width: var(--route-map-shell-w);
    max-width: var(--route-map-shell-w);
    flex: 0 0 var(--route-map-shell-w);
    border: var(--border-thin);
    border-radius: var(--radius-lg);
    background: color-mix(in oklab, var(--rm-surface-raised) 35%, var(--rm-surface));
    box-shadow: 0 1px 2px color-mix(in oklab, var(--rm-text) 6%, transparent);
  }
  .route-map-node-shell:has(.route-map-card-sel) {
    border-color: color-mix(in oklab, var(--rm-accent, #3b82f6) 42%, var(--rm-border));
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--rm-accent, #3b82f6) 28%, transparent),
      0 1px 3px color-mix(in oklab, var(--rm-text) 7%, transparent);
  }
  .route-map-node-shell .route-map-card {
    flex: 0 0 auto;
    width: var(--route-map-card-w);
    min-width: 0;
    max-width: var(--route-map-card-w);
    align-self: center;
    border-radius: calc(var(--radius-lg) - 2px);
    border: none;
    box-shadow: none;
  }
  /* Match circular “add next step” control, not a stretched pill */
  .route-map-plus-side {
    flex: 0 0 var(--route-map-plus-side-size);
    width: var(--route-map-plus-side-size);
    height: var(--route-map-plus-side-size);
    min-width: var(--route-map-plus-side-size);
    min-height: var(--route-map-plus-side-size);
    align-self: center;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, var(--rm-border) 90%, var(--rm-text));
    background: var(--rm-surface);
    font-size: 0.95rem;
  }
  .route-map-parallel-frame {
    flex: 0 1 auto;
    align-self: center;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    padding: var(--space-2);
    border: var(--border-thin);
    border-radius: var(--radius-lg);
    background: color-mix(in oklab, var(--rm-surface-raised) 25%, var(--rm-surface));
    box-sizing: border-box;
    box-shadow: 0 1px 2px color-mix(in oklab, var(--rm-text) 5%, transparent);
    overflow-x: auto;
    overflow-y: visible;
  }
  /* Parallel: single row with horizontal scroll in the frame (no wrap). */
  .route-map-parallel-inner {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: center;
    gap: 0;
    width: max-content;
    max-width: none;
    margin: 0 auto;
    box-sizing: border-box;
  }
  .route-map-parallel-link {
    flex: 0 0 0.875rem;
    width: 0.875rem;
    height: 2px;
    align-self: center;
    background: color-mix(in oklab, var(--rm-muted) 50%, var(--rm-border));
    border-radius: 1px;
  }
  .route-map-parallel-inner .route-map-parallel-branch {
    flex: 0 0 var(--route-map-shell-w);
    width: var(--route-map-shell-w);
    max-width: var(--route-map-shell-w);
    min-width: var(--route-map-shell-w);
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
  .route-map-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 1px;
    padding: 0.24rem 0.28rem 0.06rem;
    border: none;
    border-radius: var(--radius-md);
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    cursor: pointer;
    text-align: center;
    box-sizing: border-box;
    font: inherit;
    height: var(--route-map-card-h);
    min-height: var(--route-map-card-h);
    max-height: var(--route-map-card-h);
    overflow: hidden;
    transition: background-color 0.12s ease;
  }
  .route-map-node-shell:hover:not(:has(.route-map-card-sel)) {
    border-color: color-mix(in oklab, var(--rm-border) 70%, var(--rm-text));
  }
  .route-map-node-shell:hover:not(:has(.route-map-card-sel)) .route-map-card {
    background: color-mix(in oklab, var(--rm-surface-raised) 88%, var(--rm-text));
  }
  .route-map-card-tags {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem;
    width: 100%;
    max-width: 100%;
    margin-bottom: 0.65rem;
  }
  .route-map-card-tag {
    display: inline-block;
    max-width: 100%;
    padding: 0.05rem 0.16rem;
    border-radius: 2px;
    font-size: max(6px, 0.40625rem);
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.01em;
    border: 1px solid color-mix(in oklab, var(--rm-border) 80%, transparent);
    white-space: nowrap;
    text-align: center;
  }
  .route-map-card-tag--status {
    flex: 0 0 auto;
    text-transform: lowercase;
  }
  .route-map-card-tag--status-on {
    color: color-mix(in oklab, var(--rm-text) 8%, var(--rm-sage));
    background: color-mix(in oklab, var(--rm-sage) 22%, var(--rm-surface-raised));
    border-color: color-mix(in oklab, var(--rm-sage) 48%, var(--rm-border));
  }
  .route-map-card-tag--status-off {
    color: color-mix(in oklab, var(--rm-text) 12%, var(--coral-alert, #c95c5c));
    background: color-mix(in oklab, var(--coral-alert, #c95c5c) 14%, var(--rm-surface-raised));
    border-color: color-mix(in oklab, var(--coral-alert, #c95c5c) 42%, var(--rm-border));
  }
  .route-map-card-tag--kind {
    flex: 0 1 auto;
    max-width: 58%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
    text-transform: lowercase;
    letter-spacing: 0;
    color: var(--rm-muted);
    background: color-mix(in oklab, var(--rm-border) 10%, var(--rm-surface));
    font-weight: 600;
  }
  .route-map-card-off {
    opacity: 0.55;
  }
  .route-map-card-sel {
    outline: none;
    background: color-mix(in oklab, var(--rm-surface-raised) 92%, var(--rm-accent, #3b82f6));
  }
  .route-map-node-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--rm-text);
    line-height: 1.2;
    max-width: 100%;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    overflow: hidden;
    word-break: break-word;
    flex-shrink: 0;
  }
  .route-map-node-idx {
    font-size: 0.56rem;
    font-weight: 700;
    color: var(--rm-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    line-height: 1.2;
  }
  .route-map-node-idx--sub {
    font-size: 0.5rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--rm-dim);
  }
  .route-map-node-model {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--rm-text);
    line-height: 1.2;
    max-width: 100%;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    overflow: hidden;
    word-break: break-word;
    flex-shrink: 0;
  }
  .route-map-node-meta {
    font-size: 0.58rem;
    color: var(--rm-muted);
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .route-map-add-slot {
    grid-column: 1;
    grid-row: 2;
    justify-self: stretch;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 0;
    min-height: 0;
    width: 100%;
  }
  .route-map-add-slot-plain {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: var(--space-1) 0;
    box-sizing: border-box;
  }
  .route-map-chain-connector {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 4.25rem;
    padding: 0.15rem 0 0.22rem;
    box-sizing: border-box;
  }
  .route-map-chain-spine {
    position: absolute;
    left: 50%;
    top: -0.12rem;
    bottom: 0.34rem;
    width: 0;
    border-left: 2px dotted color-mix(in oklab, var(--rm-muted) 42%, var(--rm-border));
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 0;
  }
  .route-map-plus-on-spine {
    position: relative;
    z-index: 1;
    margin-top: 0.35rem;
    margin-bottom: 0.28rem;
  }
  .route-map-chain-arrow {
    position: relative;
    z-index: 1;
    margin-top: auto;
    font-size: 0.5rem;
    line-height: 1;
    color: color-mix(in oklab, var(--rm-muted) 75%, var(--rm-text));
    padding-bottom: 0.05rem;
  }
  .route-map-plus-chain {
    flex-shrink: 0;
  }
  .route-map-plus {
    width: var(--route-map-plus-side-size);
    height: var(--route-map-plus-side-size);
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, var(--rm-border) 88%, var(--rm-text));
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    font-size: 0.95rem;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .route-map-plus:hover,
  .route-map-plus:focus-visible {
    border-color: color-mix(in oklab, var(--rm-accent, #3b82f6) 45%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-accent, #3b82f6) 10%, var(--rm-surface-raised));
    outline: none;
  }
  .route-map-plus:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .route-map-plus.route-map-plus-on-spine {
    background: var(--rm-surface);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--rm-surface) 88%, var(--rm-bg));
  }
  .route-map-plus.route-map-plus-on-spine:hover,
  .route-map-plus.route-map-plus-on-spine:focus-visible {
    background: color-mix(in oklab, var(--rm-accent, #3b82f6) 10%, var(--rm-surface));
  }
</style>
